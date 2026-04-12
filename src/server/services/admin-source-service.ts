import "server-only";

import { sanitizeSlug } from "@/lib/slug";
import { assertAdminWriteAccess, resolveAdminGateContext } from "@/server/auth/admin-gate";
import { getContentRepository } from "@/server/repositories/content-repository";
import {
  getIngestionLockSnapshot,
  rerunImportRunById,
  runAllActiveSourcesJob,
  runSourceSyncJob,
} from "@/server/services/ingestion-job-service";
import type {
  CreateSourceChannelInput,
  ImportRun,
  ResolvedSourceChannel,
} from "@/types/content";

function parseBoolean(value: FormDataEntryValue | null) {
  return value === "true" || value === "on" || value === "1";
}

function parseCreateSourceInput(formData: FormData): CreateSourceChannelInput & {
  bootstrapKey?: string;
} {
  const title = String(formData.get("title") ?? "").trim();
  const slug = sanitizeSlug(String(formData.get("slug") ?? ""));
  const platformSlug = String(formData.get("platform") ?? "").trim();
  const externalChannelId = String(formData.get("externalChannelId") ?? "").trim();
  const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const bootstrapKey = String(formData.get("bootstrapKey") ?? "").trim();
  const isActive = parseBoolean(formData.get("isActive"));

  if (!title || !slug || !platformSlug) {
    throw new Error("Заполните обязательные поля источника.");
  }

  if (!externalChannelId && !sourceUrl) {
    throw new Error("Укажите URL канала или внешний channel id.");
  }

  return {
    title,
    slug,
    platformSlug,
    externalChannelId: externalChannelId || undefined,
    sourceUrl: sourceUrl || undefined,
    notes: notes || undefined,
    isActive,
    bootstrapKey: bootstrapKey || undefined,
  };
}

type SyncMode = "fresh" | "rerun";

function parseSyncMode(formData: FormData): SyncMode {
  const raw = String(formData.get("syncMode") ?? "fresh").trim();
  return raw === "rerun" ? "rerun" : "fresh";
}

function parseSyncPayload(formData: FormData) {
  const sourceId = String(formData.get("sourceId") ?? "").trim();
  const bootstrapKey = String(formData.get("bootstrapKey") ?? "").trim();
  const syncMode = parseSyncMode(formData);

  if (!sourceId) {
    throw new Error("sourceId is required for sync");
  }

  return {
    sourceId,
    syncMode,
    bootstrapKey: bootstrapKey || undefined,
  };
}

function parseSyncAllPayload(formData: FormData) {
  const bootstrapKey = String(formData.get("bootstrapKey") ?? "").trim();

  return {
    bootstrapKey: bootstrapKey || undefined,
  };
}

function parseRerunImportPayload(formData: FormData) {
  const runId = String(formData.get("runId") ?? "").trim();
  const bootstrapKey = String(formData.get("bootstrapKey") ?? "").trim();

  if (!runId) {
    throw new Error("runId is required for rerun");
  }

  return {
    runId,
    bootstrapKey: bootstrapKey || undefined,
  };
}

function applyImportFilters(
  runs: ImportRun[],
  filters: {
    q?: string;
    status?: string;
    source?: string;
  },
) {
  const q = (filters.q ?? "").trim().toLowerCase();
  const status = filters.status ?? "all";
  const source = filters.source ?? "all";

  return runs.filter((run) => {
    const matchesStatus = status === "all" || run.status === status;
    const matchesSource = source === "all" || run.sourceChannelSlug === source;

    if (!q) {
      return matchesStatus && matchesSource;
    }

    const searchable = [
      run.sourceChannelTitle,
      run.sourceChannelSlug,
      run.id,
      run.status,
      run.trigger ?? "",
      run.errorMessage ?? "",
    ]
      .join(" ")
      .toLowerCase();

    return matchesStatus && matchesSource && searchable.includes(q);
  });
}

function markChannelsInProgress(
  channels: ResolvedSourceChannel[],
  lockSnapshot: Awaited<ReturnType<typeof getIngestionLockSnapshot>>,
) {
  const activeLocks = new Set(lockSnapshot.sourceLocks.map((lock) => lock.sourceChannelId));
  return channels.map((channel) => ({
    ...channel,
    isSyncInProgress: activeLocks.has(channel.id),
  }));
}

export async function getAdminSourceRegistryData(host: string) {
  const repository = getContentRepository();
  const gate = await resolveAdminGateContext(host);
  const [channels, taxonomy, recentRuns, lockSnapshot] = await Promise.all([
    repository.listSourceChannels(),
    repository.listTaxonomy(),
    repository.listImportRuns(20),
    getIngestionLockSnapshot(),
  ]);

  return {
    gate,
    channels: markChannelsInProgress(channels, lockSnapshot),
    platforms: taxonomy.platforms,
    recentRuns,
    lockSnapshot,
  };
}

export async function createSourceChannelViaRepository(formData: FormData, host: string) {
  const input = parseCreateSourceInput(formData);
  await assertAdminWriteAccess({
    host,
    providedKey: input.bootstrapKey,
  });

  const repository = getContentRepository();
  return repository.createSourceChannel(input);
}

export async function syncSingleSourceViaRepository(formData: FormData, host: string) {
  const payload = parseSyncPayload(formData);
  await assertAdminWriteAccess({
    host,
    providedKey: payload.bootstrapKey,
  });

  return runSourceSyncJob({
    sourceId: payload.sourceId,
    trigger: payload.syncMode === "rerun" ? "rerun_source" : "sync_source",
    requestKey: `${payload.syncMode}:${payload.sourceId}:${Date.now()}`,
  });
}

export async function syncAllSourcesViaRepository(formData: FormData, host: string) {
  const payload = parseSyncAllPayload(formData);
  await assertAdminWriteAccess({
    host,
    providedKey: payload.bootstrapKey,
  });

  return runAllActiveSourcesJob({
    requestKey: `sync-all:${Date.now()}`,
  });
}

export async function rerunImportRunViaRepository(formData: FormData, host: string) {
  const payload = parseRerunImportPayload(formData);
  await assertAdminWriteAccess({
    host,
    providedKey: payload.bootstrapKey,
  });

  return rerunImportRunById({
    runId: payload.runId,
    requestKey: `rerun-run:${payload.runId}:${Date.now()}`,
  });
}

export async function getAdminImportsData(
  host: string,
  filters: {
    q?: string;
    status?: string;
    source?: string;
  },
) {
  const repository = getContentRepository();
  const gate = await resolveAdminGateContext(host);

  const normalizedFilters = {
    q: filters.q ?? "",
    status: filters.status ?? "all",
    source: filters.source ?? "all",
  };

  if (!gate.canAccessAdmin) {
    return {
      gate,
      filters: normalizedFilters,
      runs: [],
      sources: [],
      summary: {
        total: 0,
        success: 0,
        partialSuccess: 0,
        failed: 0,
        running: 0,
      },
    };
  }

  const [runs, channels] = await Promise.all([
    repository.listImportRuns(120),
    repository.listSourceChannels(),
  ]);

  const filteredRuns = applyImportFilters(runs, normalizedFilters);
  return {
    gate,
    filters: normalizedFilters,
    runs: filteredRuns,
    sources: channels.map((channel) => ({
      slug: channel.slug,
      title: channel.title,
    })),
    summary: {
      total: filteredRuns.length,
      success: filteredRuns.filter((run) => run.status === "success").length,
      partialSuccess: filteredRuns.filter((run) => run.status === "partial_success").length,
      failed: filteredRuns.filter((run) => run.status === "failed").length,
      running: filteredRuns.filter((run) => run.status === "running").length,
    },
  };
}

export async function getAdminImportRunDetailsData(host: string, runId: string) {
  const repository = getContentRepository();
  const gate = await resolveAdminGateContext(host);

  if (!gate.canAccessAdmin) {
    return {
      gate,
      run: null,
      relatedRuns: [],
    };
  }

  const run = await repository.getImportRunById(runId);
  if (!run) {
    return {
      gate,
      run: null,
      relatedRuns: [],
    };
  }

  const relatedRuns = (await repository.listImportRuns(80))
    .filter(
      (candidate) =>
        candidate.sourceChannelId === run.sourceChannelId && candidate.id !== run.id,
    )
    .slice(0, 10);

  return {
    gate,
    run,
    relatedRuns,
  };
}
