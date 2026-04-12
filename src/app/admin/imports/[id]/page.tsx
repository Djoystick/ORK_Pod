import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { ImportRunRerunForm } from "@/app/admin/imports/import-run-rerun-form";
import { AdminGateNotice } from "@/components/admin/admin-gate-notice";
import { getAdminImportRunDetailsData } from "@/server/services/admin-source-service";
import type { ImportRunItemResult } from "@/types/content";

export const metadata = {
  title: "Admin · Import Run Details",
  description: "Детали import run и item-level результаты.",
};

type AdminImportRunDetailsPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    status?: string;
    q?: string;
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

function filterItemResults(
  itemResults: ImportRunItemResult[],
  filters: { status?: string; q?: string },
) {
  const status = filters.status ?? "all";
  const q = (filters.q ?? "").trim().toLowerCase();

  return itemResults.filter((item) => {
    const matchesStatus = status === "all" || item.status === status;
    if (!q) return matchesStatus;

    const searchable = [
      item.externalSourceId,
      item.status,
      item.contentItemId ?? "",
      item.message ?? "",
    ]
      .join(" ")
      .toLowerCase();

    return matchesStatus && searchable.includes(q);
  });
}

export default async function AdminImportRunDetailsPage({
  params,
  searchParams,
}: AdminImportRunDetailsPageProps) {
  const { id } = await params;
  const filters = await searchParams;
  const host = (await headers()).get("host") ?? "";
  const { gate, run, relatedRuns } = await getAdminImportRunDetailsData(host, id);

  if (!gate.canAccessAdmin) {
    return (
      <section className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Import Run Details</p>
          <h2 className="font-display text-3xl text-zinc-100">Детали import run</h2>
        </div>
        <AdminGateNotice gate={gate} />
      </section>
    );
  }

  if (!run) {
    notFound();
  }

  const itemResults = filterItemResults(run.itemResults, filters);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Import Run Details</p>
          <h2 className="font-display text-3xl text-zinc-100">{run.id}</h2>
        </div>
        <Link
          href="/admin/imports"
          className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-white/40"
        >
          Назад к списку
        </Link>
      </div>

      <AdminGateNotice gate={gate} />

      <div className="grid gap-4 md:grid-cols-5">
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Source</p>
          <p className="mt-2 text-lg font-semibold text-zinc-100">{run.sourceChannelTitle}</p>
          <p className="text-xs text-zinc-500">{run.sourceChannelSlug}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Status</p>
          <p className="mt-2 text-lg font-semibold text-zinc-100">{run.status}</p>
          <p className="text-xs text-zinc-500">trigger: {run.trigger ?? "sync_source"}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Started</p>
          <p className="mt-2 text-sm font-medium text-zinc-100">{formatDateTime(run.startedAt)}</p>
          <p className="text-xs text-zinc-500">Finished: {formatDateTime(run.finishedAt)}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Results</p>
          <p className="mt-2 text-sm text-zinc-100">
            created {run.createdCount} · updated {run.updatedCount}
          </p>
          <p className="text-sm text-zinc-100">
            skipped {run.skippedCount} · failed {run.failedCount}
          </p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Rerun</p>
          <div className="mt-2">
            <ImportRunRerunForm gate={gate} runId={run.id} />
          </div>
        </article>
      </div>

      {run.errorMessage ? (
        <div className="rounded-xl border border-rose-300/40 bg-rose-300/10 p-3 text-sm text-rose-100">
          Ошибка run: {run.errorMessage}
        </div>
      ) : null}

      <form className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-3">
        <label className="grid gap-1 text-xs text-zinc-400">
          Поиск по item results
          <input
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="video id, status, message..."
            className="h-10 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-300/70"
          />
        </label>
        <label className="grid gap-1 text-xs text-zinc-400">
          Статус item result
          <select
            name="status"
            defaultValue={filters.status ?? "all"}
            className="h-10 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-300/70"
          >
            <option value="all">Все</option>
            <option value="created">created</option>
            <option value="updated">updated</option>
            <option value="skipped_duplicate">skipped_duplicate</option>
            <option value="failed">failed</option>
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
              <th className="px-4 py-3">External Source ID</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Content Item ID</th>
              <th className="px-4 py-3">Message</th>
            </tr>
          </thead>
          <tbody>
            {itemResults.map((item) => (
              <tr
                key={`${item.externalSourceId}-${item.status}-${item.contentItemId ?? "none"}`}
                className="border-b border-white/5 last:border-b-0"
              >
                <td className="px-4 py-3 text-zinc-100">{item.externalSourceId}</td>
                <td className="px-4 py-3 text-zinc-300">{item.status}</td>
                <td className="px-4 py-3 text-zinc-300">{item.contentItemId ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-300">{item.message ?? "—"}</td>
              </tr>
            ))}
            {itemResults.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-400">
                  По текущим фильтрам item-level результатов нет.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {relatedRuns.length > 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h3 className="font-display text-2xl text-zinc-100">Другие runs этого source</h3>
          <div className="mt-3 space-y-2">
            {relatedRuns.map((related) => (
              <Link
                key={related.id}
                href={`/admin/imports/${related.id}`}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-200 transition hover:border-white/30"
              >
                <span>{related.id}</span>
                <span>
                  {related.status} · {formatDateTime(related.startedAt)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
