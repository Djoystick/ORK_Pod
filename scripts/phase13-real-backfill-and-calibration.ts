import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { getContentRepository } from "@/server/repositories/content-repository";
import {
  rerunImportRunById,
  runAllActiveSourcesJob,
  runSourceSyncJob,
} from "@/server/services/ingestion-job-service";
import type { ImportRun, ResolvedContentItem, ResolvedSourceChannel } from "@/types/content";

type ImportedAutomationSnapshot = {
  reviewState: string;
  publishDecision: string;
  confidence: string;
  metadataReliability: string;
  sourceSlug: string;
  sourceTagsExact: boolean;
  metadataSources: string[];
  reasonCodes: string[];
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

  const metadataSources = Array.isArray(ingestion?.metadataSources)
    ? ingestion.metadataSources.filter(
        (entry): entry is string => typeof entry === "string" && entry.length > 0,
      )
    : [];
  const reasonCodes = Array.isArray(mapping?.reasonCodes)
    ? mapping.reasonCodes.filter(
        (entry): entry is string => typeof entry === "string" && entry.length > 0,
      )
    : [];

  return {
    sourceSlug: typeof ingestion?.sourceSlug === "string" ? ingestion.sourceSlug : "unknown",
    reviewState:
      typeof automation?.reviewState === "string" ? automation.reviewState : "review_unknown",
    publishDecision:
      typeof automation?.publishDecision === "string"
        ? automation.publishDecision
        : "decision_unknown",
    confidence: typeof mapping?.confidence === "string" ? mapping.confidence : "unknown",
    metadataReliability:
      typeof mapping?.metadataReliability === "string"
        ? mapping.metadataReliability
        : "unknown",
    sourceTagsExact: ingestion?.sourceTagsExact === true,
    metadataSources,
    reasonCodes,
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

  const metadataSourceTokens = imported.flatMap((entry) =>
    entry.snapshot.metadataSources.map((token) => `${entry.snapshot.sourceSlug}:${token}`),
  );
  const lowConfidenceReasons = imported
    .filter((entry) => entry.snapshot.confidence === "low" || entry.snapshot.confidence === "medium")
    .flatMap((entry) => entry.snapshot.reasonCodes);

  return {
    importedTotal: imported.length,
    duplicatesByExternalSourceId: externalIds.length - uniqueExternalIds.size,
    bySource: countBy(imported.map((entry) => entry.snapshot.sourceSlug)),
    byStatus: countBy(imported.map((entry) => entry.item.status ?? "draft")),
    byConfidence: countBy(imported.map((entry) => entry.snapshot.confidence)),
    byReviewState: countBy(imported.map((entry) => entry.snapshot.reviewState)),
    byPublishDecision: countBy(imported.map((entry) => entry.snapshot.publishDecision)),
    byMetadataReliability: countBy(imported.map((entry) => entry.snapshot.metadataReliability)),
    sourceTagsExactCoverage: {
      exactCount: imported.filter((entry) => entry.snapshot.sourceTagsExact).length,
      total: imported.length,
    },
    metadataSourceUsage: countBy(metadataSourceTokens),
    lowConfidenceReasonClusters: countBy(lowConfidenceReasons),
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

  const baselineItems = await repository.listAdminContentItems();
  const baselineSummary = summarizeImported(baselineItems);

  const previousMaxItems = process.env.YOUTUBE_INGESTION_MAX_ITEMS_PER_SOURCE;
  const parsedPrevious = Number.parseInt(previousMaxItems ?? "", 10);
  if (!Number.isFinite(parsedPrevious) || parsedPrevious < 50) {
    process.env.YOUTUBE_INGESTION_MAX_ITEMS_PER_SOURCE = "50";
  }

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
      requestKey: `phase13-backfill-source-${source.slug}-${Date.now()}`,
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
    requestKey: `phase13-backfill-dedupe-${Date.now()}`,
  });

  const runsAfterBackfill = await repository.listImportRuns(120);
  const rerunCandidates = runsAfterBackfill
    .filter((run) => run.status === "failed" || run.status === "partial_success")
    .slice(0, 5);

  const rerunAttempts: Array<{
    sourceSlug: string;
    parentRunId: string;
    rerunRunId: string | null;
    rerunStatus: string;
    trigger: ImportRun["trigger"] | null;
    failed: number | null;
    error: string | null;
  }> = [];

  for (const candidate of rerunCandidates) {
    try {
      const rerun = await rerunImportRunById({
        runId: candidate.id,
        requestKey: `phase13-rerun-${candidate.id}-${Date.now()}`,
      });

      rerunAttempts.push({
        sourceSlug: candidate.sourceChannelSlug,
        parentRunId: candidate.id,
        rerunRunId: rerun.id,
        rerunStatus: rerun.status,
        trigger: rerun.trigger ?? null,
        failed: rerun.failedCount,
        error: rerun.errorMessage ?? null,
      });
    } catch (error) {
      rerunAttempts.push({
        sourceSlug: candidate.sourceChannelSlug,
        parentRunId: candidate.id,
        rerunRunId: null,
        rerunStatus: "exception",
        trigger: null,
        failed: null,
        error: error instanceof Error ? error.message : "unknown_rerun_exception",
      });
    }
  }

  const afterItems = await repository.listAdminContentItems();
  const afterSummary = summarizeImported(afterItems);

  if (previousMaxItems !== undefined) {
    process.env.YOUTUBE_INGESTION_MAX_ITEMS_PER_SOURCE = previousMaxItems;
  } else {
    delete process.env.YOUTUBE_INGESTION_MAX_ITEMS_PER_SOURCE;
  }

  const report = {
    generatedAt: new Date().toISOString(),
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
    rerunAttempts,
    afterSummary,
    delta: {
      importedTotal: afterSummary.importedTotal - baselineSummary.importedTotal,
      exactTagsCount:
        afterSummary.sourceTagsExactCoverage.exactCount -
        baselineSummary.sourceTagsExactCoverage.exactCount,
      duplicatesByExternalSourceId: afterSummary.duplicatesByExternalSourceId,
    },
  };

  const dataDir = path.join(process.cwd(), "data");
  await mkdir(dataDir, { recursive: true });
  const outputPath = path.join(dataDir, "phase13-backfill-summary.json");
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(JSON.stringify(report, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

