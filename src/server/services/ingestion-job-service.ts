import { randomUUID } from "node:crypto";

import "server-only";

import { getContentRepository } from "@/server/repositories/content-repository";
import {
  readLocalIngestionLocks,
  writeLocalIngestionLocks,
} from "@/server/storage/local-fallback-store";
import type {
  ImportRun,
  ImportRunTrigger,
  IngestionLockSnapshot,
  IngestionSourceLock,
  ResolvedSourceChannel,
  SyncAllExecutionResult,
} from "@/types/content";

const DEFAULT_LOCK_TTL_MS = 20 * 60 * 1000;

let mutationChain: Promise<void> = Promise.resolve();

function getLockTtlMs() {
  const value = Number.parseInt(process.env.INGESTION_LOCK_TTL_MS ?? "", 10);
  if (Number.isFinite(value) && value > 0) {
    return value;
  }

  return DEFAULT_LOCK_TTL_MS;
}

function nowIso() {
  return new Date().toISOString();
}

function computeExpiresAt(acquiredAt: string) {
  return new Date(new Date(acquiredAt).getTime() + getLockTtlMs()).toISOString();
}

function pruneExpiredLocks(snapshot: IngestionLockSnapshot, nowValue: string) {
  const nowTs = new Date(nowValue).getTime();

  const sourceLocks = snapshot.sourceLocks.filter((lock) => {
    const expiresTs = new Date(lock.expiresAt).getTime();
    return Number.isFinite(expiresTs) && expiresTs > nowTs;
  });

  let globalSyncAllLock = snapshot.globalSyncAllLock;
  if (globalSyncAllLock) {
    const expiresTs = new Date(globalSyncAllLock.expiresAt).getTime();
    if (!Number.isFinite(expiresTs) || expiresTs <= nowTs) {
      globalSyncAllLock = null;
    }
  }

  return {
    globalSyncAllLock,
    sourceLocks,
  } satisfies IngestionLockSnapshot;
}

async function withLockMutation<T>(mutation: () => Promise<T>) {
  const previous = mutationChain;
  let release!: () => void;
  mutationChain = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  try {
    return await mutation();
  } finally {
    release();
  }
}

async function readPrunedLockSnapshot() {
  const existing = await readLocalIngestionLocks();
  const pruned = pruneExpiredLocks(existing, nowIso());

  const changed =
    existing.globalSyncAllLock?.id !== pruned.globalSyncAllLock?.id ||
    existing.sourceLocks.length !== pruned.sourceLocks.length;

  if (changed) {
    await writeLocalIngestionLocks(pruned);
  }

  return pruned;
}

function createSourceLock(params: {
  source: ResolvedSourceChannel;
  trigger: ImportRunTrigger;
  requestKey?: string;
  runId?: string;
}) {
  const acquiredAt = nowIso();
  return {
    id: `lock-${randomUUID()}`,
    sourceChannelId: params.source.id,
    sourceChannelSlug: params.source.slug,
    sourceChannelTitle: params.source.title,
    trigger: params.trigger,
    requestKey: params.requestKey,
    runId: params.runId,
    acquiredAt,
    expiresAt: computeExpiresAt(acquiredAt),
  } satisfies IngestionSourceLock;
}

function createGlobalLock(params: {
  trigger: ImportRunTrigger;
  requestKey?: string;
}) {
  const acquiredAt = nowIso();
  return {
    id: `lock-global-${randomUUID()}`,
    sourceChannelId: "__all__",
    sourceChannelSlug: "all-active-sources",
    sourceChannelTitle: "All active sources",
    trigger: params.trigger,
    requestKey: params.requestKey,
    acquiredAt,
    expiresAt: computeExpiresAt(acquiredAt),
  } satisfies IngestionSourceLock;
}

async function acquireGlobalSyncAllLock(params: {
  trigger: ImportRunTrigger;
  requestKey?: string;
}) {
  return withLockMutation(async () => {
    const snapshot = await readPrunedLockSnapshot();
    if (snapshot.globalSyncAllLock) {
      return {
        ok: false as const,
        reason:
          "Синхронизация всех источников уже выполняется. Дождитесь завершения текущего запуска.",
      };
    }

    const lock = createGlobalLock(params);
    const nextSnapshot = {
      ...snapshot,
      globalSyncAllLock: lock,
    } satisfies IngestionLockSnapshot;
    await writeLocalIngestionLocks(nextSnapshot);

    return {
      ok: true as const,
      lock,
    };
  });
}

async function releaseGlobalSyncAllLock(lockId: string) {
  await withLockMutation(async () => {
    const snapshot = await readPrunedLockSnapshot();
    if (snapshot.globalSyncAllLock?.id !== lockId) {
      return;
    }

    await writeLocalIngestionLocks({
      ...snapshot,
      globalSyncAllLock: null,
    });
  });
}

async function acquireSourceLock(params: {
  source: ResolvedSourceChannel;
  trigger: ImportRunTrigger;
  requestKey?: string;
  runId?: string;
}) {
  return withLockMutation(async () => {
    const snapshot = await readPrunedLockSnapshot();

    if (snapshot.globalSyncAllLock && params.trigger !== "sync_all") {
      return {
        ok: false as const,
        reason:
          "Сейчас выполняется Sync All. Повторите запуск source sync после завершения общего прогона.",
      };
    }

    const existingSourceLock = snapshot.sourceLocks.find(
      (lock) => lock.sourceChannelId === params.source.id,
    );
    if (existingSourceLock) {
      return {
        ok: false as const,
        reason: `Источник ${params.source.slug} уже синхронизируется (trigger: ${existingSourceLock.trigger}).`,
      };
    }

    const lock = createSourceLock(params);
    const nextSnapshot = {
      ...snapshot,
      sourceLocks: [...snapshot.sourceLocks, lock],
    } satisfies IngestionLockSnapshot;
    await writeLocalIngestionLocks(nextSnapshot);

    return {
      ok: true as const,
      lock,
    };
  });
}

async function releaseSourceLock(lockId: string) {
  await withLockMutation(async () => {
    const snapshot = await readPrunedLockSnapshot();
    const nextLocks = snapshot.sourceLocks.filter((lock) => lock.id !== lockId);
    if (nextLocks.length === snapshot.sourceLocks.length) {
      return;
    }

    await writeLocalIngestionLocks({
      ...snapshot,
      sourceLocks: nextLocks,
    });
  });
}

async function getSourceById(sourceId: string) {
  const repository = getContentRepository();
  const sources = await repository.listSourceChannels();
  const source = sources.find((entry) => entry.id === sourceId);
  if (!source) {
    throw new Error("Источник не найден.");
  }

  return source;
}

export async function getIngestionLockSnapshot() {
  return readPrunedLockSnapshot();
}

export async function runSourceSyncJob(params: {
  sourceId: string;
  trigger?: ImportRunTrigger;
  parentRunId?: string;
  requestKey?: string;
}) {
  const repository = getContentRepository();
  const source = await getSourceById(params.sourceId);
  const trigger = params.trigger ?? "sync_source";
  const sourceLock = await acquireSourceLock({
    source,
    trigger,
    requestKey: params.requestKey,
  });

  if (!sourceLock.ok) {
    throw new Error(sourceLock.reason);
  }

  try {
    return await repository.runSourceSync(source.id, {
      trigger,
      parentRunId: params.parentRunId,
      requestKey: params.requestKey,
      lockAcquiredAt: sourceLock.lock.acquiredAt,
    });
  } finally {
    await releaseSourceLock(sourceLock.lock.id);
  }
}

export async function rerunImportRunById(params: {
  runId: string;
  requestKey?: string;
}) {
  const repository = getContentRepository();
  const run = await repository.getImportRunById(params.runId);
  if (!run) {
    throw new Error("Import run не найден.");
  }

  return runSourceSyncJob({
    sourceId: run.sourceChannelId,
    trigger: "rerun_source",
    parentRunId: run.id,
    requestKey: params.requestKey,
  });
}

export async function runAllActiveSourcesJob(params?: {
  requestKey?: string;
}): Promise<SyncAllExecutionResult> {
  const repository = getContentRepository();
  const globalLock = await acquireGlobalSyncAllLock({
    trigger: "sync_all",
    requestKey: params?.requestKey,
  });

  if (!globalLock.ok) {
    throw new Error(globalLock.reason);
  }

  try {
    const channels = await repository.listSourceChannels();
    const activeChannels = channels.filter((entry) => entry.isActive);
    const runs: ImportRun[] = [];
    const skippedLockedSources: SyncAllExecutionResult["skippedLockedSources"] = [];

    for (const source of activeChannels) {
      const sourceLock = await acquireSourceLock({
        source,
        trigger: "sync_all",
        requestKey: params?.requestKey,
      });

      if (!sourceLock.ok) {
        skippedLockedSources.push({
          sourceChannelId: source.id,
          sourceChannelSlug: source.slug,
          sourceChannelTitle: source.title,
          reason: sourceLock.reason,
        });
        continue;
      }

      try {
        const run = await repository.runSourceSync(source.id, {
          trigger: "sync_all",
          requestKey: params?.requestKey,
          lockAcquiredAt: sourceLock.lock.acquiredAt,
        });
        runs.push(run);
      } finally {
        await releaseSourceLock(sourceLock.lock.id);
      }
    }

    return {
      runs,
      skippedLockedSources,
    };
  } finally {
    await releaseGlobalSyncAllLock(globalLock.lock.id);
  }
}

export async function runScheduledSyncAllEntryPoint(options?: { requestKey?: string }) {
  return runAllActiveSourcesJob({
    requestKey: options?.requestKey ?? `scheduled-${nowIso()}`,
  });
}

export async function runScheduledSourceSyncEntryPoint(options: {
  sourceId: string;
  requestKey?: string;
}) {
  return runSourceSyncJob({
    sourceId: options.sourceId,
    trigger: "sync_source",
    requestKey: options.requestKey ?? `scheduled-source-${options.sourceId}-${nowIso()}`,
  });
}
