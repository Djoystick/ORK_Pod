import { getContentRepository } from "@/server/repositories/content-repository";
import {
  getIngestionLockSnapshot,
  rerunImportRunById,
  runAllActiveSourcesJob,
  runSourceSyncJob,
} from "@/server/services/ingestion-job-service";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const repository = getContentRepository();
  const sources = await repository.listSourceChannels();

  const orkcut = sources.find((source) => source.slug === "orkcut");
  const orkstream = sources.find((source) => source.slug === "orkstream");
  const orkpod = sources.find((source) => source.slug === "orkpod-youtube");

  if (!orkcut || !orkstream) {
    throw new Error("Missing required source channels orkcut/orkstream.");
  }

  const dedupeRunFirst = await runSourceSyncJob({
    sourceId: orkstream.id,
    trigger: "sync_source",
    requestKey: `phase05-dedupe-first-${Date.now()}`,
  });
  const dedupeRunSecond = await runSourceSyncJob({
    sourceId: orkstream.id,
    trigger: "sync_source",
    requestKey: `phase05-dedupe-second-${Date.now()}`,
  });

  const concurrentFirst = runSourceSyncJob({
    sourceId: orkcut.id,
    trigger: "sync_source",
    requestKey: `phase05-concurrency-first-${Date.now()}`,
  });
  await wait(50);
  const concurrentSecond = runSourceSyncJob({
    sourceId: orkcut.id,
    trigger: "sync_source",
    requestKey: `phase05-concurrency-second-${Date.now()}`,
  });
  const concurrentResults = await Promise.allSettled([concurrentFirst, concurrentSecond]);

  const sourceSyncForAllGuard = runSourceSyncJob({
    sourceId: orkcut.id,
    trigger: "sync_source",
    requestKey: `phase05-syncall-guard-source-${Date.now()}`,
  });
  await wait(50);
  const syncAllDuringSingle = await runAllActiveSourcesJob({
    requestKey: `phase05-syncall-guard-all-${Date.now()}`,
  });
  const singleAfterSyncAll = await sourceSyncForAllGuard;

  let failedRunId: string | null = null;
  let rerunResultStatus: string | null = null;
  if (orkpod) {
    const orkpodRun = await runSourceSyncJob({
      sourceId: orkpod.id,
      trigger: "sync_source",
      requestKey: `phase05-orkpod-check-${Date.now()}`,
    });

    if (orkpodRun.status === "failed" || orkpodRun.status === "partial_success") {
      failedRunId = orkpodRun.id;
      const rerun = await rerunImportRunById({
        runId: orkpodRun.id,
        requestKey: `phase05-rerun-failed-${Date.now()}`,
      });
      rerunResultStatus = rerun.status;
    } else {
      failedRunId = orkpodRun.id;
      const rerun = await rerunImportRunById({
        runId: orkpodRun.id,
        requestKey: `phase05-rerun-generic-${Date.now()}`,
      });
      rerunResultStatus = rerun.status;
    }
  }

  const adminItems = await repository.listAdminContentItems();
  const importedItems = adminItems.filter(
    (item) => item.sourceType === "imported" && Boolean(item.externalSourceId),
  );
  const externalIds = importedItems
    .map((item) => item.externalSourceId as string)
    .filter(Boolean);
  const uniqueExternalIds = new Set(externalIds);

  const lockSnapshot = await getIngestionLockSnapshot();
  const latestRuns = await repository.listImportRuns(10);

  const concurrencyRejected = concurrentResults.find(
    (entry) => entry.status === "rejected",
  );

  const summary = {
    requiredSourcesPresent: {
      orkcut: Boolean(orkcut),
      orkstream: Boolean(orkstream),
    },
    dedupe: {
      first: {
        status: dedupeRunFirst.status,
        created: dedupeRunFirst.createdCount,
        updated: dedupeRunFirst.updatedCount,
        skipped: dedupeRunFirst.skippedCount,
        failed: dedupeRunFirst.failedCount,
      },
      second: {
        status: dedupeRunSecond.status,
        created: dedupeRunSecond.createdCount,
        updated: dedupeRunSecond.updatedCount,
        skipped: dedupeRunSecond.skippedCount,
        failed: dedupeRunSecond.failedCount,
      },
      duplicateExternalIds: externalIds.length - uniqueExternalIds.size,
    },
    antiConcurrency: {
      firstResult:
        concurrentResults[0].status === "fulfilled"
          ? concurrentResults[0].value.status
          : concurrentResults[0].reason instanceof Error
            ? concurrentResults[0].reason.message
            : String(concurrentResults[0].reason),
      secondResult:
        concurrentResults[1].status === "fulfilled"
          ? concurrentResults[1].value.status
          : concurrentResults[1].reason instanceof Error
            ? concurrentResults[1].reason.message
            : String(concurrentResults[1].reason),
      hasRejectedParallelAttempt: Boolean(concurrencyRejected),
    },
    syncAllGuard: {
      singleRunStatus: singleAfterSyncAll.status,
      syncAllRunsCount: syncAllDuringSingle.runs.length,
      syncAllSkippedLockedSources: syncAllDuringSingle.skippedLockedSources,
    },
    rerun: {
      runId: failedRunId,
      rerunResultStatus,
    },
    lockSnapshotAfterRuns: {
      globalLock: lockSnapshot.globalSyncAllLock,
      sourceLocksCount: lockSnapshot.sourceLocks.length,
    },
    latestRunIds: latestRuns.map((run) => run.id),
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
