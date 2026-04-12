import Link from "next/link";
import { headers } from "next/headers";

import { BulkPublishReadyForm } from "@/app/admin/content/bulk-publish-ready-form";
import { AdminGateNotice } from "@/components/admin/admin-gate-notice";
import { formatRuDate } from "@/lib/content";
import type { PublishReadinessResult } from "@/lib/publish-readiness";
import { getAdminContentListData } from "@/server/services/admin-content-service";

type AdminContentPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    sourceType?: string;
    platform?: string;
    category?: string;
    review?: string;
    confidence?: string;
    metadataMode?: string;
    publishReady?: string;
  }>;
};

type MappingPreview = {
  confidence: "high" | "medium" | "low";
  needsReview: boolean;
  fallbackUsed: boolean;
  categorySlug: string | null;
  seriesSlug: string | null;
  tagCount: number;
  reviewState: "review_needed" | "review_light" | "auto_published";
  publishDecision: "keep_draft" | "review_required" | "auto_publish";
  metadataReliability: "high" | "medium" | "low" | null;
  metadataMode: "exact_api" | "api_backed" | "best_effort" | "unknown";
  dataAcquisitionPath: string | null;
};

function statusBadge(status?: string) {
  if (status === "published") {
    return "border-emerald-400/40 bg-emerald-300/10 text-emerald-100";
  }
  if (status === "archived") {
    return "border-zinc-400/35 bg-zinc-400/10 text-zinc-200";
  }
  return "border-amber-400/40 bg-amber-300/10 text-amber-100";
}

function getMappingPreview(item: { sourcePayload?: Record<string, unknown> | null }) {
  if (!item.sourcePayload || typeof item.sourcePayload !== "object") {
    return null;
  }

  const candidate = (item.sourcePayload as Record<string, unknown>).mapping;
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const mapping = candidate as Record<string, unknown>;
  if (
    mapping.confidence !== "high" &&
    mapping.confidence !== "medium" &&
    mapping.confidence !== "low"
  ) {
    return null;
  }

  const automation =
    (item.sourcePayload as Record<string, unknown>).automation &&
    typeof (item.sourcePayload as Record<string, unknown>).automation === "object"
      ? ((item.sourcePayload as Record<string, unknown>).automation as Record<string, unknown>)
      : null;
  const ingestion =
    (item.sourcePayload as Record<string, unknown>).ingestion &&
    typeof (item.sourcePayload as Record<string, unknown>).ingestion === "object"
      ? ((item.sourcePayload as Record<string, unknown>).ingestion as Record<string, unknown>)
      : null;

  const reviewState =
    automation?.reviewState === "review_needed" ||
    automation?.reviewState === "review_light" ||
    automation?.reviewState === "auto_published"
      ? automation.reviewState
      : mapping.needsReview !== false
        ? "review_needed"
        : "review_light";

  const publishDecision =
    automation?.publishDecision === "keep_draft" ||
    automation?.publishDecision === "review_required" ||
    automation?.publishDecision === "auto_publish"
      ? automation.publishDecision
      : mapping.needsReview !== false
        ? "review_required"
        : "keep_draft";

  const metadataReliability =
    mapping.metadataReliability === "high" ||
    mapping.metadataReliability === "medium" ||
    mapping.metadataReliability === "low"
      ? mapping.metadataReliability
      : null;
  const sourceTagsExact = ingestion?.sourceTagsExact === true;
  const youtubeDataApiUsed = ingestion?.youtubeDataApiUsed === true;
  const metadataMode = sourceTagsExact
    ? "exact_api"
    : youtubeDataApiUsed
      ? "api_backed"
      : "best_effort";
  const dataAcquisitionPath =
    typeof ingestion?.dataAcquisitionPath === "string" ? ingestion.dataAcquisitionPath : null;

  return {
    confidence: mapping.confidence,
    needsReview: mapping.needsReview !== false,
    fallbackUsed: mapping.fallbackUsed !== false,
    categorySlug: typeof mapping.categorySlug === "string" ? mapping.categorySlug : null,
    seriesSlug: typeof mapping.seriesSlug === "string" ? mapping.seriesSlug : null,
    tagCount: Array.isArray(mapping.tagIds)
      ? mapping.tagIds.filter((entry) => typeof entry === "string").length
      : 0,
    reviewState,
    publishDecision,
    metadataReliability,
    metadataMode,
    dataAcquisitionPath,
  } satisfies MappingPreview;
}

function mappingBadge(mapping: MappingPreview | null) {
  if (!mapping) {
    return "border-zinc-500/40 bg-zinc-500/10 text-zinc-300";
  }

  if (mapping.reviewState === "auto_published") {
    return "border-emerald-400/40 bg-emerald-300/10 text-emerald-100";
  }

  if (mapping.reviewState === "review_light") {
    return "border-emerald-400/40 bg-emerald-300/10 text-emerald-100";
  }

  if (mapping.confidence === "medium" || mapping.metadataReliability === "medium") {
    return "border-lime-400/40 bg-lime-300/10 text-lime-100";
  }

  return "border-amber-400/40 bg-amber-300/10 text-amber-100";
}

function readinessReasonLabel(key: string) {
  if (key === "status_draft") return "status_draft";
  if (key === "title") return "title";
  if (key === "slug") return "slug";
  if (key === "primary_link") return "primary_link";
  if (key === "description") return "description";
  if (key === "cover") return "cover";
  if (key === "automation_confidence") return "confidence";
  if (key === "automation_review") return "review_state";
  if (key === "automation_publish_decision") return "publish_decision";
  if (key === "automation_metadata_reliability") return "metadata_reliability";
  return key;
}

export default async function AdminContentPage({ searchParams }: AdminContentPageProps) {
  const params = await searchParams;
  const host = (await headers()).get("host") ?? "";
  const { gate, filters, items, taxonomy, publishReadinessById, publishReadinessSummary } =
    await getAdminContentListData(host, params);

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">CMS</p>
        <h2 className="font-display text-3xl text-zinc-100">Контент</h2>
      </div>

      <AdminGateNotice gate={gate} />
      <BulkPublishReadyForm gate={gate} summary={publishReadinessSummary} />

      <form className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-9">
        <label className="grid gap-1 text-xs text-zinc-400">
          Поиск
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="заголовок, slug, категория..."
            className="h-10 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-emerald-300/70"
          />
        </label>
        <label className="grid gap-1 text-xs text-zinc-400">
          Статус
          <select
            name="status"
            defaultValue={filters.status}
            className="h-10 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-emerald-300/70"
          >
            <option value="all">Все</option>
            <option value="draft">draft</option>
            <option value="published">published</option>
            <option value="archived">archived</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs text-zinc-400">
          Source type
          <select
            name="sourceType"
            defaultValue={filters.sourceType}
            className="h-10 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-emerald-300/70"
          >
            <option value="all">Все</option>
            <option value="manual">manual</option>
            <option value="imported">imported</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs text-zinc-400">
          Платформа
          <select
            name="platform"
            defaultValue={filters.platform}
            className="h-10 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-emerald-300/70"
          >
            <option value="all">Все</option>
            {taxonomy.platforms.map((platform) => (
              <option key={platform.id} value={platform.slug}>
                {platform.title}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-zinc-400">
          Категория
          <select
            name="category"
            defaultValue={filters.category}
            className="h-10 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-emerald-300/70"
          >
            <option value="all">Все</option>
            {taxonomy.categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.title}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-zinc-400">
          Automation
          <select
            name="review"
            defaultValue={filters.review}
            className="h-10 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-emerald-300/70"
          >
            <option value="all">all</option>
            <option value="review_needed">review_needed</option>
            <option value="review_light">review_light</option>
            <option value="auto_published">auto_published</option>
            <option value="no_signals">no_signals</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs text-zinc-400">
          Confidence
          <select
            name="confidence"
            defaultValue={filters.confidence}
            className="h-10 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-emerald-300/70"
          >
            <option value="all">all</option>
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
            <option value="no_signals">no_signals</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs text-zinc-400">
          Metadata mode
          <select
            name="metadataMode"
            defaultValue={filters.metadataMode}
            className="h-10 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-emerald-300/70"
          >
            <option value="all">all</option>
            <option value="exact_api">exact_api</option>
            <option value="api_backed">api_backed</option>
            <option value="best_effort">best_effort</option>
            <option value="no_signals">no_signals</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs text-zinc-400">
          Publish ready
          <select
            name="publishReady"
            defaultValue={filters.publishReady}
            className="h-10 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-emerald-300/70"
          >
            <option value="all">all</option>
            <option value="ready">ready</option>
            <option value="blocked">blocked</option>
          </select>
        </label>
        <div className="md:col-span-9">
          <button
            type="submit"
            className="h-10 rounded-lg bg-white px-4 text-sm font-semibold text-black transition hover:bg-zinc-200"
          >
            Применить фильтры
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <p className="text-sm text-zinc-300">
          Найдено: <span className="font-semibold text-zinc-100">{items.length}</span>
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-[0.12em] text-zinc-500">
            <tr>
              <th className="px-4 py-3">Заголовок</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3">Источник</th>
              <th className="px-4 py-3">Категория</th>
              <th className="px-4 py-3">Платформа</th>
              <th className="px-4 py-3">Auto-map</th>
              <th className="px-4 py-3">Publish-ready</th>
              <th className="px-4 py-3">Дата</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const mapping = getMappingPreview(item);
              const readiness = publishReadinessById[item.id] as PublishReadinessResult | undefined;
              return (
                <tr key={item.id} className="border-b border-white/5 last:border-b-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-100">{item.title}</p>
                    <p className="text-xs text-zinc-500">{item.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2.5 py-1 text-xs ${statusBadge(item.status)}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{item.sourceType}</td>
                  <td className="px-4 py-3 text-zinc-300">{item.category.title}</td>
                  <td className="px-4 py-3 text-zinc-300">{item.platform.title}</td>
                  <td className="px-4 py-3">
                    {item.sourceType === "imported" ? (
                      <div className="space-y-1">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${mappingBadge(mapping)}`}>
                          {mapping
                            ? `${mapping.confidence} · ${mapping.reviewState}`
                            : "not_mapped"}
                        </span>
                        {mapping ? (
                          <p className="text-[11px] text-zinc-400">
                            {mapping.categorySlug ?? "category?"}
                            {mapping.seriesSlug ? ` / ${mapping.seriesSlug}` : ""} · tags{" "}
                            {mapping.tagCount}
                            {mapping.fallbackUsed ? " · fallback" : ""}
                            {mapping.metadataReliability
                              ? ` · metadata ${mapping.metadataReliability}`
                              : ""}
                            {` · ${mapping.metadataMode}`}
                            {mapping.dataAcquisitionPath
                              ? ` · ${mapping.dataAcquisitionPath}`
                              : ""}
                            {` · ${mapping.publishDecision}`}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {readiness ? (
                      <div className="space-y-1">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${
                            readiness.isReady
                              ? "border-emerald-400/40 bg-emerald-300/10 text-emerald-100"
                              : "border-amber-400/40 bg-amber-300/10 text-amber-100"
                          }`}
                        >
                          {readiness.isReady ? "ready" : "blocked"}
                        </span>
                        {!readiness.isReady ? (
                          <p className="text-[11px] text-zinc-400">
                            {readiness.failedChecks
                              .slice(0, 2)
                              .map((entry) => readinessReasonLabel(entry.key))
                              .join(", ")}
                          </p>
                        ) : (
                          <p className="text-[11px] text-zinc-400">
                            checks passed · {readiness.checks.length}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{formatRuDate(item.publishedAt)}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/content/${item.id}`}
                      className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-white/35"
                    >
                      Редактировать
                    </Link>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-zinc-400">
                  Ничего не найдено по текущим фильтрам.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
