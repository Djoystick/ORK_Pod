import Link from "next/link";
import { headers } from "next/headers";

import { BootstrapPublishedForm } from "@/app/admin/bootstrap-published-form";
import { AdminGateNotice } from "@/components/admin/admin-gate-notice";
import { getAdminOverviewData } from "@/server/services/admin-content-service";

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed);
}

export default async function AdminPage() {
  const host = (await headers()).get("host") ?? "";
  const { gate, stats, ingestionRuntimeWarning } = await getAdminOverviewData(host);

  return (
    <section className="space-y-4">
      <AdminGateNotice gate={gate} />
      {ingestionRuntimeWarning ? (
        <div className="rounded-xl border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
          {ingestionRuntimeWarning}
        </div>
      ) : null}
      <BootstrapPublishedForm
        gate={gate}
        publishedCount={stats?.statusCounts.published ?? 0}
      />

      <div className="grid gap-4 md:grid-cols-7">
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Контент</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-100">{stats?.totalContent ?? 0}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Published</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-100">
            {stats?.statusCounts.published ?? 0}
          </p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Draft</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-100">
            {stats?.statusCounts.draft ?? 0}
          </p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Sources</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-100">{stats?.totalSources ?? 0}</p>
          <p className="text-xs text-zinc-400">active: {stats?.activeSources ?? 0}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Import Runs</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-100">
            {stats?.importRunsTotal ?? 0}
          </p>
          <p className="text-xs text-zinc-400">failed: {stats?.importRunsFailed ?? 0}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Comments</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-100">{stats?.commentsTotal ?? 0}</p>
          <p className="text-xs text-zinc-400">pending: {stats?.commentsPending ?? 0}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Last Import</p>
          <p className="mt-2 text-sm font-medium text-zinc-100">
            {formatDateTime(stats?.lastImportRunAt)}
          </p>
        </article>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="font-display text-2xl text-zinc-100">Управление контентом</h2>
          <p className="mt-2 text-sm text-zinc-300">
            Список всех записей, редактирование карточек и переключение статусов.
          </p>
          <Link
            href="/admin/content"
            className="mt-4 inline-flex rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200"
          >
            Перейти к контенту
          </Link>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="font-display text-2xl text-zinc-100">Создание записи</h2>
          <p className="mt-2 text-sm text-zinc-300">
            Ручное добавление через repository/service слой.
          </p>
          <Link
            href="/admin/new"
            className="mt-4 inline-flex rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200"
          >
            Новая запись
          </Link>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="font-display text-2xl text-zinc-100">Реестр источников</h2>
          <p className="mt-2 text-sm text-zinc-300">
            Source channels для multi-channel YouTube ingestion и ручные sync-действия.
          </p>
          <Link
            href="/admin/sources"
            className="mt-4 inline-flex rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200"
          >
            Открыть реестр
          </Link>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="font-display text-2xl text-zinc-100">История импортов</h2>
          <p className="mt-2 text-sm text-zinc-300">
            Аудит последних import runs, статусов и счетчиков created/updated/skipped/failed.
          </p>
          <Link
            href="/admin/imports"
            className="mt-4 inline-flex rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200"
          >
            Открыть историю
          </Link>
        </article>

        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="font-display text-2xl text-zinc-100">Модерация community</h2>
          <p className="mt-2 text-sm text-zinc-300">
            Комментарии в статусах pending/approved/hidden/rejected и ручные actions модерации.
          </p>
          <Link
            href="/admin/moderation"
            className="mt-4 inline-flex rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200"
          >
            Открыть модерацию
          </Link>
        </article>
      </div>
    </section>
  );
}
