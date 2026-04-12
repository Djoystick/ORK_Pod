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
import {
  getIngestionRuntimeUnavailableMessage,
  isIngestionRuntimeUnavailableError,
} from "@/server/services/ingestion-runtime-guard";
import type {
  CreateSourceChannelInput,
  ImportRun,
  ResolvedContentItem,
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

function summarizeIngestionAutomation(items: ResolvedContentItem[]) {
  const imported = items.filter((item) => item.sourceType === "imported");

  const summary = imported.reduce(
    (acc, item) => {
      const payload =
        item.sourcePayload && typeof item.sourcePayload === "object"
          ? (item.sourcePayload as Record<string, unknown>)
          : null;
      const ingestion =
        payload?.ingestion && typeof payload.ingestion === "object"
          ? (payload.ingestion as Record<string, unknown>)
          : null;
      const automation =
        payload?.automation && typeof payload.automation === "object"
          ? (payload.automation as Record<string, unknown>)
          : null;
      const mapping =
        payload?.mapping && typeof payload.mapping === "object"
          ? (payload.mapping as Record<string, unknown>)
          : null;

      const sourceTagsExact = ingestion?.sourceTagsExact === true;
      const apiBacked = ingestion?.youtubeDataApiUsed === true;
      const reviewState =
        automation?.reviewState === "review_needed" ||
        automation?.reviewState === "review_light" ||
        automation?.reviewState === "auto_published"
          ? automation.reviewState
          : mapping?.needsReview !== false
            ? "review_needed"
            : "review_light";

      acc.importedTotal += 1;
      if (apiBacked) {
        acc.apiBackedTotal += 1;
      } else {
        acc.bestEffortTotal += 1;
      }
      if (sourceTagsExact) {
        acc.exactTagsTotal += 1;
      }
      if (reviewState === "review_needed") {
        acc.reviewNeededTotal += 1;
      }

      return acc;
    },
    {
      importedTotal: 0,
      apiBackedTotal: 0,
      exactTagsTotal: 0,
      bestEffortTotal: 0,
      reviewNeededTotal: 0,
    },
  );

  return summary;
}

export async function getAdminSourceRegistryData(host: string) {
  const repository = getContentRepository();
  const gate = await resolveAdminGateContext(host);
  const [channels, taxonomy, lockSnapshot] = await Promise.all([
    repository.listSourceChannels(),
    repository.listTaxonomy(),
    getIngestionLockSnapshot(),
  ]);
  let recentRuns: ImportRun[] = [];
  let ingestionRuntimeWarning: string | null = null;

  try {
    recentRuns = await repository.listImportRuns(20);
  } catch (error) {
    if (!isIngestionRuntimeUnavailableError(error)) {
      throw error;
    }
    ingestionRuntimeWarning = getIngestionRuntimeUnavailableMessage();
  }

  return {
    gate,
    channels: markChannelsInProgress(channels, lockSnapshot),
    platforms: taxonomy.platforms,
    recentRuns,
    lockSnapshot,
    ingestionRuntimeWarning,
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
      ingestionRuntimeWarning: null as string | null,
      summary: {
        total: 0,
        success: 0,
        partialSuccess: 0,
        failed: 0,
        running: 0,
      },
      automationSummary: {
        importedTotal: 0,
        apiBackedTotal: 0,
        exactTagsTotal: 0,
        bestEffortTotal: 0,
        reviewNeededTotal: 0,
      },
    };
  }

  const [channels, adminItems] = await Promise.all([
    repository.listSourceChannels(),
    repository.listAdminContentItems(),
  ]);
  let runs: ImportRun[] = [];
  let ingestionRuntimeWarning: string | null = null;

  try {
    runs = await repository.listImportRuns(120);
  } catch (error) {
    if (!isIngestionRuntimeUnavailableError(error)) {
      throw error;
    }
    ingestionRuntimeWarning = getIngestionRuntimeUnavailableMessage();
  }

  const filteredRuns = applyImportFilters(runs, normalizedFilters);
  const automationSummary = summarizeIngestionAutomation(adminItems);
  return {
    gate,
    filters: normalizedFilters,
    runs: filteredRuns,
    ingestionRuntimeWarning,
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
    automationSummary,
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
      ingestionRuntimeWarning: null as string | null,
      ingestionRuntimeUnavailable: false,
    };
  }

  let run: ImportRun | null = null;
  let ingestionRuntimeWarning: string | null = null;
  let ingestionRuntimeUnavailable = false;
  try {
    run = await repository.getImportRunById(runId);
  } catch (error) {
    if (!isIngestionRuntimeUnavailableError(error)) {
      throw error;
    }
    ingestionRuntimeWarning = getIngestionRuntimeUnavailableMessage();
    ingestionRuntimeUnavailable = true;
  }

  if (!run) {
    return {
      gate,
      run: null,
      relatedRuns: [],
      ingestionRuntimeWarning,
      ingestionRuntimeUnavailable,
    };
  }

  let relatedRuns: ImportRun[] = [];
  try {
    relatedRuns = (await repository.listImportRuns(80))
      .filter(
        (candidate) =>
          candidate.sourceChannelId === run.sourceChannelId && candidate.id !== run.id,
      )
      .slice(0, 10);
  } catch (error) {
    if (!isIngestionRuntimeUnavailableError(error)) {
      throw error;
    }
    ingestionRuntimeWarning = getIngestionRuntimeUnavailableMessage();
    ingestionRuntimeUnavailable = true;
  }

  return {
    gate,
    run,
    relatedRuns,
    ingestionRuntimeWarning,
    ingestionRuntimeUnavailable,
  };
}
