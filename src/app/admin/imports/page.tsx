import Link from "next/link";
import { headers } from "next/headers";

import { ImportRunRerunForm } from "@/app/admin/imports/import-run-rerun-form";
import { AdminGateNotice } from "@/components/admin/admin-gate-notice";
import { getAdminImportsData } from "@/server/services/admin-source-service";
import type { ImportRun } from "@/types/content";

export const metadata = {
  title: "Admin · Imports",
  description: "История import runs с фильтрами и rerun flow.",
};

type AdminImportsPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    source?: string;
  }>;
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed);
}

function statusBadge(status: ImportRun["status"]) {
  if (status === "success") {
    return "border-emerald-400/40 bg-emerald-300/10 text-emerald-100";
  }
  if (status === "partial_success") {
    return "border-amber-400/40 bg-amber-300/10 text-amber-100";
  }
  if (status === "failed") {
    return "border-rose-400/40 bg-rose-300/10 text-rose-100";
  }
  if (status === "running") {
    return "border-cyan-400/40 bg-cyan-300/10 text-cyan-100";
  }

  return "border-zinc-400/40 bg-zinc-300/10 text-zinc-100";
}

export default async function AdminImportsPage({ searchParams }: AdminImportsPageProps) {
  const params = await searchParams;
  const host = (await headers()).get("host") ?? "";
  const { gate, runs, sources, filters, summary, automationSummary, ingestionRuntimeWarning } =
    await getAdminImportsData(host, params);

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Ingestion Audit V2</p>
        <h2 className="font-display text-3xl text-zinc-100">История импортов</h2>
      </div>

      <AdminGateNotice gate={gate} />
      {ingestionRuntimeWarning ? (
        <div className="rounded-xl border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
          {ingestionRuntimeWarning}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-5">
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Total</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">{summary.total}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Success</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">{summary.success}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Partial</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">{summary.partialSuccess}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Failed</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">{summary.failed}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Running</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">{summary.running}</p>
        </article>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Imported Total</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">{automationSummary.importedTotal}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">API-backed</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">{automationSummary.apiBackedTotal}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Exact Tags</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">{automationSummary.exactTagsTotal}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Best-effort</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">{automationSummary.bestEffortTotal}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Review Needed</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">{automationSummary.reviewNeededTotal}</p>
        </article>
      </div>

      <form className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-4">
        <label className="grid gap-1 text-xs text-zinc-400">
          Поиск
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="id, source, trigger, error..."
            className="h-10 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-300/70"
          />
        </label>
        <label className="grid gap-1 text-xs text-zinc-400">
          Статус
          <select
            name="status"
            defaultValue={filters.status}
            className="h-10 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-300/70"
          >
            <option value="all">Все</option>
            <option value="queued">queued</option>
            <option value="running">running</option>
            <option value="success">success</option>
            <option value="partial_success">partial_success</option>
            <option value="failed">failed</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs text-zinc-400">
          Source
          <select
            name="source"
            defaultValue={filters.source}
            className="h-10 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-300/70"
          >
            <option value="all">Все</option>
            {sources.map((source) => (
              <option key={source.slug} value={source.slug}>
                {source.title} ({source.slug})
              </option>
            ))}
          </select>
        </label>
        <div className="self-end">
          <button
            type="submit"
            className="h-10 rounded-lg bg-white px-4 text-sm font-semibold text-black transition hover:bg-zinc-200"
          >
            Применить
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-[0.12em] text-zinc-500">
            <tr>
              <th className="px-4 py-3">Run</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Trigger</th>
              <th className="px-4 py-3">Started</th>
              <th className="px-4 py-3">Result</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id} className="border-b border-white/5 align-top last:border-b-0">
                <td className="px-4 py-3 text-zinc-200">
                  <Link
                    href={`/admin/imports/${run.id}`}
                    className="underline decoration-zinc-500 underline-offset-2"
                  >
                    {run.id}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-100">
                  <p className="font-medium">{run.sourceChannelTitle}</p>
                  <p className="text-xs text-zinc-500">{run.sourceChannelSlug}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full border px-2.5 py-1 text-xs ${statusBadge(run.status)}`}>
                    {run.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-300">{run.trigger ?? "sync_source"}</td>
                <td className="px-4 py-3 text-zinc-300">
                  <p>{formatDateTime(run.startedAt)}</p>
                  <p className="text-xs text-zinc-500">end: {formatDateTime(run.finishedAt)}</p>
                </td>
                <td className="px-4 py-3 text-zinc-300">
                  <p>created {run.createdCount}</p>
                  <p>updated {run.updatedCount}</p>
                  <p>skipped {run.skippedCount}</p>
                  <p>failed {run.failedCount}</p>
                </td>
                <td className="px-4 py-3">
                  {run.status === "failed" || run.status === "partial_success" ? (
                    <ImportRunRerunForm gate={gate} runId={run.id} compact />
                  ) : (
                    <Link
                      href={`/admin/imports/${run.id}`}
                      className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-white/40"
                    >
                      Details
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {runs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                  По текущим фильтрам import runs не найдены.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
