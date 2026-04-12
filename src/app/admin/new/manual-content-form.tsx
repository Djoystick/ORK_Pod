"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import {
  createManualContentAction,
  initialCreateManualActionState,
} from "@/app/admin/new/actions";
import { sanitizeSlug } from "@/lib/slug";
import type { AdminGateContext } from "@/server/auth/admin-gate";
import type { Category, Platform, Series } from "@/types/content";

type ManualContentFormProps = {
  gate: AdminGateContext;
  categories: Category[];
  series: Series[];
  platforms: Platform[];
};

export function ManualContentForm({
  gate,
  categories,
  series,
  platforms,
}: ManualContentFormProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>(categories[0]?.slug ?? "");
  const [state, formAction, isPending] = useActionState(
    createManualContentAction,
    initialCreateManualActionState,
  );

  const visibleSeries = useMemo(
    () =>
      series.filter((entry) => {
        const category = categories.find((item) => item.slug === selectedCategory);
        return category ? entry.categoryId === category.id : true;
      }),
    [series, categories, selectedCategory],
  );

  const isDisabled = !gate.canAccessAdmin;

  return (
    <form action={formAction} className="space-y-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="rounded-xl border border-amber-300/30 bg-amber-200/10 p-4 text-sm text-amber-100">
        <p className="font-semibold">Временный admin bootstrap</p>
        <p className="mt-1 text-amber-100/90">{gate.message}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm text-zinc-300">
          Заголовок *
          <input
            required
            name="title"
            type="text"
            placeholder="Например: Manual: новая запись"
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
            type="text"
            placeholder="manual-new-entry"
            className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-zinc-100 outline-none transition focus:border-cyan-300/70"
          />
        </label>
      </div>

      <label className="grid gap-2 text-sm text-zinc-300">
        Краткий анонс (excerpt) *
        <input
          required
          name="excerpt"
          type="text"
          placeholder="Короткое описание для карточки каталога"
          className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-zinc-100 outline-none transition focus:border-cyan-300/70"
        />
      </label>

      <label className="grid gap-2 text-sm text-zinc-300">
        Описание *
        <textarea
          required
          name="description"
          rows={4}
          placeholder="Подробное описание выпуска"
          className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-zinc-100 outline-none transition focus:border-cyan-300/70"
        />
      </label>

      <label className="grid gap-2 text-sm text-zinc-300">
        Текст / body (опционально)
        <textarea
          name="body"
          rows={5}
          placeholder="Расширенный текст записи для будущего rich-editor режима"
          className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-zinc-100 outline-none transition focus:border-cyan-300/70"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2 text-sm text-zinc-300">
          Категория *
          <select
            required
            name="category"
            value={selectedCategory}
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
          Серия
          <select
            name="series"
            defaultValue=""
            className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-zinc-100 outline-none transition focus:border-cyan-300/70"
          >
            <option value="">Без серии</option>
            {visibleSeries.map((entry) => (
              <option key={entry.id} value={entry.slug}>
                {entry.title}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm text-zinc-300">
          Платформа *
          <select
            required
            name="platform"
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
            type="url"
            placeholder="https://youtube.com/watch?v=..."
            className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-zinc-100 outline-none transition focus:border-cyan-300/70"
          />
        </label>

        <label className="grid gap-2 text-sm text-zinc-300">
          Дата публикации
          <input
            name="publishedAt"
            type="date"
            className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-zinc-100 outline-none transition focus:border-cyan-300/70"
          />
        </label>

        <label className="grid gap-2 text-sm text-zinc-300">
          Статус *
          <select
            required
            name="status"
            defaultValue="draft"
            className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-zinc-100 outline-none transition focus:border-cyan-300/70"
          >
            <option value="draft">draft</option>
            <option value="published">published</option>
            <option value="archived">archived</option>
          </select>
        </label>
      </div>

      {gate.requiresKeyForWrites ? (
        <label className="grid gap-2 text-sm text-zinc-300">
          Bootstrap ключ *
          <input
            required
            name="bootstrapKey"
            type="password"
            className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-zinc-100 outline-none transition focus:border-cyan-300/70"
          />
        </label>
      ) : null}

      <input type="hidden" name="sourceType" value="manual" />

      {state.status !== "idle" ? (
        <div
          className={`rounded-xl border p-3 text-sm ${
            state.status === "success"
              ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100"
              : "border-rose-300/40 bg-rose-300/10 text-rose-100"
          }`}
        >
          {state.message}
          {state.slug ? (
            <span>
              {" "}
              <Link href={`/streams/${state.slug}`} className="underline underline-offset-2">
                Открыть страницу записи
              </Link>
            </span>
          ) : null}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isPending || isDisabled}
        className="h-11 rounded-xl bg-white px-4 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Создание..." : "Создать запись"}
      </button>
    </form>
  );
}
