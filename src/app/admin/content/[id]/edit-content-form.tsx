"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import {
  setContentStatusAction,
  updateContentAction,
  type UpdateContentActionState,
} from "@/app/admin/content/[id]/actions";
import { AdminGateNotice } from "@/components/admin/admin-gate-notice";
import { sanitizeSlug } from "@/lib/slug";
import type { AdminGateContext } from "@/server/auth/admin-gate";
import type { Category, Platform, ResolvedContentItem, Series } from "@/types/content";

const INITIAL_UPDATE_CONTENT_ACTION_STATE: UpdateContentActionState = {
  status: "idle",
  message: "",
};

type EditContentFormProps = {
  gate: AdminGateContext;
  item: ResolvedContentItem;
  categories: Category[];
  series: Series[];
  platforms: Platform[];
  initialExternalUrl: string;
};

type MappingPreview = {
  confidence: "high" | "medium" | "low";
  needsReview: boolean;
  fallbackUsed: boolean;
  score: number | null;
  metadataReliability: "high" | "medium" | "low" | null;
  reviewState: "review_needed" | "review_light" | "auto_published";
  publishDecision: "keep_draft" | "review_required" | "auto_publish";
  reasonCodes: string[];
  automationReasonCodes: string[];
  matchedTerms: string[];
  categorySlug: string | null;
  seriesSlug: string | null;
  tagCount: number;
};

function extractMappingPreview(payload: Record<string, unknown> | null | undefined) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload.mapping;
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
    payload.automation && typeof payload.automation === "object"
      ? (payload.automation as Record<string, unknown>)
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

  return {
    confidence: mapping.confidence,
    needsReview: mapping.needsReview !== false,
    fallbackUsed: mapping.fallbackUsed !== false,
    score: typeof mapping.score === "number" ? mapping.score : null,
    metadataReliability:
      mapping.metadataReliability === "high" ||
      mapping.metadataReliability === "medium" ||
      mapping.metadataReliability === "low"
        ? mapping.metadataReliability
        : null,
    reviewState,
    publishDecision,
    reasonCodes: Array.isArray(mapping.reasonCodes)
      ? mapping.reasonCodes.filter((entry): entry is string => typeof entry === "string")
      : [],
    automationReasonCodes: Array.isArray(automation?.reasonCodes)
      ? automation.reasonCodes.filter((entry): entry is string => typeof entry === "string")
      : [],
    matchedTerms: Array.isArray(mapping.matchedTerms)
      ? mapping.matchedTerms.filter((entry): entry is string => typeof entry === "string")
      : [],
    categorySlug: typeof mapping.categorySlug === "string" ? mapping.categorySlug : null,
    seriesSlug: typeof mapping.seriesSlug === "string" ? mapping.seriesSlug : null,
    tagCount: Array.isArray(mapping.tagIds)
      ? mapping.tagIds.filter((entry) => typeof entry === "string").length
      : 0,
  } satisfies MappingPreview;
}

export function EditContentForm({
  gate,
  item,
  categories,
  series,
  platforms,
  initialExternalUrl,
}: EditContentFormProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>(item.category.slug);
  const [updateState, updateAction, isUpdatePending] = useActionState(
    updateContentAction,
    INITIAL_UPDATE_CONTENT_ACTION_STATE,
  );
  const [statusState, statusAction, isStatusPending] = useActionState(
    setContentStatusAction,
    INITIAL_UPDATE_CONTENT_ACTION_STATE,
  );

  const visibleSeries = useMemo(
    () =>
      series.filter((entry) => {
        const category = categories.find((itemEntry) => itemEntry.slug === selectedCategory);
        return category ? entry.categoryId === category.id : true;
      }),
    [series, categories, selectedCategory],
  );
  const mappingPreview = useMemo(
    () => extractMappingPreview(item.sourcePayload ?? null),
    [item.sourcePayload],
  );

  const isDisabled = !gate.canAccessAdmin;

  return (
    <section className="space-y-4">
      <AdminGateNotice gate={gate} />

      <form action={updateAction} className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <input type="hidden" name="id" value={item.id} />

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm text-zinc-300">
            Р—Р°РіРѕР»РѕРІРѕРє *
            <input
              required
              name="title"
              defaultValue={item.title}
              className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-zinc-100 outline-none transition focus:border-cyan-300/70"
              onChange={(event) => {
                const form = event.currentTarget.form;
                if (!form) return;
                const slugInput = form.elements.namedItem("slug");
                if (!(slugInput instanceof HTMLInputElement) || slugInput.value.trim()) return;
                slugInput.value = sanitizeSlug(event.currentTarget.value);
              }}
            />
          </label>

          <label className="grid gap-2 text-sm text-zinc-300">
            Slug *
            <input
              required
              name="slug"
              defaultValue={item.slug}
              className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-zinc-100 outline-none transition focus:border-cyan-300/70"
            />
          </label>
        </div>

        <label className="grid gap-2 text-sm text-zinc-300">
          Excerpt *
          <input
            required
            name="excerpt"
            defaultValue={item.excerpt}
            className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-zinc-100 outline-none transition focus:border-cyan-300/70"
          />
        </label>

        <label className="grid gap-2 text-sm text-zinc-300">
          Description *
          <textarea
            required
            name="description"
            rows={4}
            defaultValue={item.description}
            className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-zinc-100 outline-none transition focus:border-cyan-300/70"
          />
        </label>

        <label className="grid gap-2 text-sm text-zinc-300">
          Body
          <textarea
            name="body"
            rows={6}
            defaultValue={item.body ?? ""}
            className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-zinc-100 outline-none transition focus:border-cyan-300/70"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-2 text-sm text-zinc-300">
            РљР°С‚РµРіРѕСЂРёСЏ *
            <select
              required
              name="category"
              defaultValue={item.category.slug}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-zinc-100 outline-none transition focus:border-cyan-300/70"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.title}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm text-zinc-300">
            РЎРµСЂРёСЏ
            <select
              name="series"
              defaultValue={item.series?.slug ?? ""}
              className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-zinc-100 outline-none transition focus:border-cyan-300/70"
            >
              <option value="">Р‘РµР· СЃРµСЂРёРё</option>
              {visibleSeries.map((entry) => (
                <option key={entry.id} value={entry.slug}>
                  {entry.title}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm text-zinc-300">
            РџР»Р°С‚С„РѕСЂРјР° *
            <select
              required
              name="platform"
              defaultValue={item.platform.slug}
              className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-zinc-100 outline-none transition focus:border-cyan-300/70"
            >
              {platforms.map((platform) => (
                <option key={platform.id} value={platform.slug}>
                  {platform.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="grid gap-2 text-sm text-zinc-300">
            External URL *
            <input
              required
              name="externalUrl"
              defaultValue={initialExternalUrl}
              className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-zinc-100 outline-none transition focus:border-cyan-300/70"
            />
          </label>

          <label className="grid gap-2 text-sm text-zinc-300">
            Р”Р°С‚Р° РїСѓР±Р»РёРєР°С†РёРё
            <input
              name="publishedAt"
              type="date"
              defaultValue={(item.publishedAt ?? "").slice(0, 10)}
              className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-zinc-100 outline-none transition focus:border-cyan-300/70"
            />
          </label>

          <label className="grid gap-2 text-sm text-zinc-300">
            РЎС‚Р°С‚СѓСЃ
            <select
              name="status"
              defaultValue={item.status ?? "draft"}
              className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-zinc-100 outline-none transition focus:border-cyan-300/70"
            >
              <option value="draft">draft</option>
              <option value="published">published</option>
              <option value="archived">archived</option>
            </select>
          </label>
        </div>

        <label className="grid gap-2 text-sm text-zinc-300">
          Source type
          <input
            readOnly
            value={item.sourceType ?? "manual"}
            className="h-11 rounded-xl border border-white/15 bg-black/40 px-3 text-zinc-400"
          />
        </label>

        {item.sourceType === "imported" ? (
          <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-xs text-zinc-300">
            <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
              Ingestion Auto-mapping
            </p>
            {mappingPreview ? (
              <div className="mt-2 space-y-1.5">
                <p>
                  confidence:{" "}
                  <span className="font-semibold text-zinc-100">{mappingPreview.confidence}</span>
                  {mappingPreview.needsReview ? " · review required" : ""}
                  {mappingPreview.score !== null ? ` · score ${mappingPreview.score}` : ""}
                </p>
                <p>
                  review/publish:{" "}
                  <span className="text-zinc-100">
                    {mappingPreview.reviewState} · {mappingPreview.publishDecision}
                  </span>
                  {mappingPreview.metadataReliability
                    ? ` · metadata ${mappingPreview.metadataReliability}`
                    : ""}
                </p>
                <p>
                  category/series:{" "}
                  <span className="text-zinc-100">
                    {mappingPreview.categorySlug ?? "?"}
                    {mappingPreview.seriesSlug ? ` / ${mappingPreview.seriesSlug}` : ""}
                  </span>
                </p>
                <p>
                  tags mapped: <span className="text-zinc-100">{mappingPreview.tagCount}</span>
                  {mappingPreview.fallbackUsed ? " · fallback used" : ""}
                </p>
                {mappingPreview.matchedTerms.length > 0 ? (
                  <p className="line-clamp-2 text-zinc-400">
                    matched: {mappingPreview.matchedTerms.slice(0, 10).join(", ")}
                  </p>
                ) : null}
                {mappingPreview.reasonCodes.length > 0 ? (
                  <p className="line-clamp-2 text-zinc-500">
                    mapping reasons: {mappingPreview.reasonCodes.slice(0, 8).join(", ")}
                  </p>
                ) : null}
                {mappingPreview.automationReasonCodes.length > 0 ? (
                  <p className="line-clamp-2 text-zinc-500">
                    decision reasons: {mappingPreview.automationReasonCodes.slice(0, 8).join(", ")}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-zinc-400">
                Auto-mapping metadata not found for this imported item.
              </p>
            )}
          </div>
        ) : null}

        {gate.requiresKeyForWrites ? (
          <label className="grid gap-2 text-sm text-zinc-300">
            Bootstrap РєР»СЋС‡ *
            <input
              required
              name="bootstrapKey"
              type="password"
              className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-zinc-100 outline-none transition focus:border-cyan-300/70"
            />
          </label>
        ) : null}

        {updateState.status !== "idle" ? (
          <div
            className={`rounded-xl border p-3 text-sm ${
              updateState.status === "success"
                ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100"
                : "border-rose-300/40 bg-rose-300/10 text-rose-100"
            }`}
          >
            {updateState.message}
            {updateState.slug ? (
              <span>
                {" "}
                <Link href={`/streams/${updateState.slug}`} className="underline underline-offset-2">
                  РћС‚РєСЂС‹С‚СЊ РїСѓР±Р»РёС‡РЅСѓСЋ СЃС‚СЂР°РЅРёС†Сѓ
                </Link>
              </span>
            ) : null}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isDisabled || isUpdatePending}
          className="h-11 rounded-xl bg-white px-4 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isUpdatePending ? "РЎРѕС…СЂР°РЅРµРЅРёРµ..." : "РЎРѕС…СЂР°РЅРёС‚СЊ РёР·РјРµРЅРµРЅРёСЏ"}
        </button>
      </form>

      <form action={statusAction} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <input type="hidden" name="id" value={item.id} />
        {gate.requiresKeyForWrites ? (
          <label className="mb-3 grid gap-2 text-sm text-zinc-300">
            Bootstrap РєР»СЋС‡ *
            <input
              required
              name="bootstrapKey"
              type="password"
              className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-zinc-100 outline-none transition focus:border-cyan-300/70"
            />
          </label>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            name="status"
            value="published"
            disabled={isDisabled || isStatusPending}
            className="rounded-xl border border-emerald-300/40 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-100 transition hover:bg-emerald-300/20 disabled:opacity-60"
          >
            Publish
          </button>
          <button
            type="submit"
            name="status"
            value="draft"
            disabled={isDisabled || isStatusPending}
            className="rounded-xl border border-amber-300/40 bg-amber-300/10 px-4 py-2 text-sm text-amber-100 transition hover:bg-amber-300/20 disabled:opacity-60"
          >
            Unpublish to draft
          </button>
          <button
            type="submit"
            name="status"
            value="archived"
            disabled={isDisabled || isStatusPending}
            className="rounded-xl border border-zinc-300/40 bg-zinc-300/10 px-4 py-2 text-sm text-zinc-100 transition hover:bg-zinc-300/20 disabled:opacity-60"
          >
            Archive
          </button>
        </div>

        {statusState.status !== "idle" ? (
          <div
            className={`mt-3 rounded-xl border p-3 text-sm ${
              statusState.status === "success"
                ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100"
                : "border-rose-300/40 bg-rose-300/10 text-rose-100"
            }`}
          >
            {statusState.message}
          </div>
        ) : null}
      </form>
    </section>
  );
}

