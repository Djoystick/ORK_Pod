import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { getContentRepository } from "@/server/repositories/content-repository";
import { runAllActiveSourcesJob, runSourceSyncJob } from "@/server/services/ingestion-job-service";
import type { ImportRun, ResolvedContentItem, ResolvedSourceChannel } from "@/types/content";

type ImportedAutomationSnapshot = {
  sourceSlug: string;
  reviewState: string;
  confidence: string;
  metadataReliability: string;
  dataAcquisitionPath: string;
  youtubeDataApiUsed: boolean;
  sourceTagsExact: boolean;
};

function countBy<T extends string>(values: T[]) {
  const counters = new Map<string, number>();
  for (const value of values) {
    counters.set(value, (counters.get(value) ?? 0) + 1);
  }

  return Object.fromEntries(
    [...counters.entries()].sort((a, b) => b[1] - a[1]),
  ) as Record<string, number>;
}

function toAutomationSnapshot(item: ResolvedContentItem): ImportedAutomationSnapshot | null {
  if (item.sourceType !== "imported") {
    return null;
  }

  const payload =
    item.sourcePayload && typeof item.sourcePayload === "object"
      ? (item.sourcePayload as Record<string, unknown>)
      : null;
  if (!payload) {
    return null;
  }

  const ingestion =
    payload.ingestion && typeof payload.ingestion === "object"
      ? (payload.ingestion as Record<string, unknown>)
      : null;
  const mapping =
    payload.mapping && typeof payload.mapping === "object"
      ? (payload.mapping as Record<string, unknown>)
      : null;
  const automation =
    payload.automation && typeof payload.automation === "object"
      ? (payload.automation as Record<string, unknown>)
      : null;

  return {
    sourceSlug: typeof ingestion?.sourceSlug === "string" ? ingestion.sourceSlug : "unknown",
    reviewState:
      typeof automation?.reviewState === "string"
        ? automation.reviewState
        : mapping?.needsReview !== false
          ? "review_needed"
          : "review_light",
    confidence: typeof mapping?.confidence === "string" ? mapping.confidence : "unknown",
    metadataReliability:
      typeof mapping?.metadataReliability === "string" ? mapping.metadataReliability : "unknown",
    dataAcquisitionPath:
      typeof ingestion?.dataAcquisitionPath === "string"
        ? ingestion.dataAcquisitionPath
        : "unknown",
    youtubeDataApiUsed: ingestion?.youtubeDataApiUsed === true,
    sourceTagsExact: ingestion?.sourceTagsExact === true,
  };
}

function summarizeImported(items: ResolvedContentItem[]) {
  const imported = items
    .filter((item) => item.sourceType === "imported")
    .map((item) => ({ item, snapshot: toAutomationSnapshot(item) }))
    .filter(
      (entry): entry is { item: ResolvedContentItem; snapshot: ImportedAutomationSnapshot } =>
        Boolean(entry.snapshot),
    );

  const externalIds = imported
    .map((entry) => entry.item.externalSourceId ?? "")
    .filter((entry) => entry.length > 0);
  const uniqueExternalIds = new Set(externalIds);

  const apiBackedTotal = imported.filter((entry) => entry.snapshot.youtubeDataApiUsed).length;
  const exactTagsTotal = imported.filter((entry) => entry.snapshot.sourceTagsExact).length;
  const reviewNeededTotal = imported.filter(
    (entry) => entry.snapshot.reviewState === "review_needed",
  ).length;

  return {
    importedTotal: imported.length,
    duplicatesByExternalSourceId: externalIds.length - uniqueExternalIds.size,
    bySource: countBy(imported.map((entry) => entry.snapshot.sourceSlug)),
    byAcquisitionPath: countBy(imported.map((entry) => entry.snapshot.dataAcquisitionPath)),
    byReviewState: countBy(imported.map((entry) => entry.snapshot.reviewState)),
    byConfidence: countBy(imported.map((entry) => entry.snapshot.confidence)),
    byMetadataReliability: countBy(imported.map((entry) => entry.snapshot.metadataReliability)),
    apiBackedCoverage: {
      apiBackedTotal,
      bestEffortTotal: imported.length - apiBackedTotal,
      total: imported.length,
    },
    exactTagsCoverage: {
      exactTagsTotal,
      total: imported.length,
    },
    reviewNeededTotal,
  };
}

function orderSourcesForBackfill(sources: ResolvedSourceChannel[]) {
  const activeYouTube = sources.filter(
    (source) => source.isActive && source.platform.slug === "youtube",
  );
  const mandatoryOrder = ["orkcut", "orkstream"];

  const mandatorySources = mandatoryOrder
    .map((slug) => activeYouTube.find((source) => source.slug === slug))
    .filter((entry): entry is ResolvedSourceChannel => Boolean(entry));
  const remaining = activeYouTube.filter(
    (source) => !mandatoryOrder.includes(source.slug),
  );

  return [...mandatorySources, ...remaining];
}

async function run() {
  const repository = getContentRepository();
  const sources = await repository.listSourceChannels();
  const orderedSources = orderSourcesForBackfill(sources);

  const hasOrkcut = orderedSources.some((source) => source.slug === "orkcut");
  const hasOrkstream = orderedSources.some((source) => source.slug === "orkstream");
  if (!hasOrkcut || !hasOrkstream) {
    throw new Error("Required channels orkcut/orkstream were not found among active YouTube sources.");
  }

  const apiKeyConfigured = (process.env.YOUTUBE_DATA_API_KEY ?? "").trim().length > 0;
  const previousPrimaryFlag = process.env.YOUTUBE_DATA_API_PREFER_PRIMARY;
  const previousBackfillMax = process.env.YOUTUBE_DATA_API_BACKFILL_MAX_ITEMS_PER_SOURCE;
  const previousPageSize = process.env.YOUTUBE_DATA_API_BACKFILL_PAGE_SIZE;

  if (apiKeyConfigured) {
    process.env.YOUTUBE_DATA_API_PREFER_PRIMARY = "true";

    const currentBackfillMax = Number.parseInt(
      process.env.YOUTUBE_DATA_API_BACKFILL_MAX_ITEMS_PER_SOURCE ?? "",
      10,
    );
    if (!Number.isFinite(currentBackfillMax) || currentBackfillMax < 120) {
      process.env.YOUTUBE_DATA_API_BACKFILL_MAX_ITEMS_PER_SOURCE = "120";
    }

    const currentPageSize = Number.parseInt(
      process.env.YOUTUBE_DATA_API_BACKFILL_PAGE_SIZE ?? "",
      10,
    );
    if (!Number.isFinite(currentPageSize) || currentPageSize <= 0) {
      process.env.YOUTUBE_DATA_API_BACKFILL_PAGE_SIZE = "50";
    }
  }

  const baselineItems = await repository.listAdminContentItems();
  const baselineSummary = summarizeImported(baselineItems);

  const sourceRuns: Array<{
    sourceSlug: string;
    runId: string;
    status: ImportRun["status"];
    trigger: ImportRun["trigger"];
    created: number;
    updated: number;
    skipped: number;
    failed: number;
    error: string | null;
  }> = [];

  for (const source of orderedSources) {
    const run = await runSourceSyncJob({
      sourceId: source.id,
      trigger: "sync_source",
      requestKey: `phase14-api-source-${source.slug}-${Date.now()}`,
    });

    sourceRuns.push({
      sourceSlug: source.slug,
      runId: run.id,
      status: run.status,
      trigger: run.trigger,
      created: run.createdCount,
      updated: run.updatedCount,
      skipped: run.skippedCount,
      failed: run.failedCount,
      error: run.errorMessage ?? null,
    });
  }

  const dedupePass = await runAllActiveSourcesJob({
    requestKey: `phase14-api-dedupe-${Date.now()}`,
  });

  const afterItems = await repository.listAdminContentItems();
  const afterSummary = summarizeImported(afterItems);
  const effectiveApiConfig = {
    apiKeyConfigured,
    preferPrimary: process.env.YOUTUBE_DATA_API_PREFER_PRIMARY ?? null,
    backfillMaxItemsPerSource:
      process.env.YOUTUBE_DATA_API_BACKFILL_MAX_ITEMS_PER_SOURCE ?? null,
    backfillPageSize: process.env.YOUTUBE_DATA_API_BACKFILL_PAGE_SIZE ?? null,
  };

  if (previousPrimaryFlag !== undefined) {
    process.env.YOUTUBE_DATA_API_PREFER_PRIMARY = previousPrimaryFlag;
  } else {
    delete process.env.YOUTUBE_DATA_API_PREFER_PRIMARY;
  }
  if (previousBackfillMax !== undefined) {
    process.env.YOUTUBE_DATA_API_BACKFILL_MAX_ITEMS_PER_SOURCE = previousBackfillMax;
  } else {
    delete process.env.YOUTUBE_DATA_API_BACKFILL_MAX_ITEMS_PER_SOURCE;
  }
  if (previousPageSize !== undefined) {
    process.env.YOUTUBE_DATA_API_BACKFILL_PAGE_SIZE = previousPageSize;
  } else {
    delete process.env.YOUTUBE_DATA_API_BACKFILL_PAGE_SIZE;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    apiConfig: effectiveApiConfig,
    activeYouTubeSources: orderedSources.map((source) => ({
      id: source.id,
      slug: source.slug,
      title: source.title,
      externalChannelId: source.externalChannelId ?? null,
      sourceUrl: source.sourceUrl ?? null,
      isActive: source.isActive,
    })),
    baselineSummary,
    sourceRuns,
    dedupePass: {
      runsCount: dedupePass.runs.length,
      skippedLockedSources: dedupePass.skippedLockedSources,
      aggregate: {
        created: dedupePass.runs.reduce((acc, run) => acc + run.createdCount, 0),
        updated: dedupePass.runs.reduce((acc, run) => acc + run.updatedCount, 0),
        skipped: dedupePass.runs.reduce((acc, run) => acc + run.skippedCount, 0),
        failed: dedupePass.runs.reduce((acc, run) => acc + run.failedCount, 0),
      },
    },
    afterSummary,
    delta: {
      importedTotal: afterSummary.importedTotal - baselineSummary.importedTotal,
      apiBackedTotal:
        afterSummary.apiBackedCoverage.apiBackedTotal -
        baselineSummary.apiBackedCoverage.apiBackedTotal,
      exactTagsTotal:
        afterSummary.exactTagsCoverage.exactTagsTotal -
        baselineSummary.exactTagsCoverage.exactTagsTotal,
      duplicatesByExternalSourceId: afterSummary.duplicatesByExternalSourceId,
    },
  };

  const dataDir = path.join(process.cwd(), "data");
  await mkdir(dataDir, { recursive: true });
  const outputPath = path.join(dataDir, "phase14-api-backfill-summary.json");
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(JSON.stringify(report, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
