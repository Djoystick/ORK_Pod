import { headers } from "next/headers";
import Link from "next/link";

import { CommentModerationForm } from "@/app/admin/moderation/comment-moderation-form";
import { AdminGateNotice } from "@/components/admin/admin-gate-notice";
import { getAdminModerationData } from "@/server/services/community-service";

type AdminModerationPageProps = {
  searchParams: Promise<{
    status?: string;
    q?: string;
  }>;
};

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed);
}

function statusBadge(status: string) {
  if (status === "approved") return "border-emerald-400/40 bg-emerald-300/10 text-emerald-100";
  if (status === "hidden") return "border-zinc-400/40 bg-zinc-400/10 text-zinc-200";
  if (status === "rejected") return "border-rose-400/40 bg-rose-300/10 text-rose-100";
  return "border-amber-400/40 bg-amber-300/10 text-amber-100";
}

export default async function AdminModerationPage({ searchParams }: AdminModerationPageProps) {
  const params = await searchParams;
  const host = (await headers()).get("host") ?? "";
  const { gate, filters, comments, summary } = await getAdminModerationData(host, params);

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Community</p>
        <h2 className="font-display text-3xl text-zinc-100">Модерация комментариев</h2>
      </div>

      <AdminGateNotice gate={gate} />

      <div className="grid gap-3 md:grid-cols-5">
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Total</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">{summary.total}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Pending</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">{summary.pending}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Approved</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">{summary.approved}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Hidden</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">{summary.hidden}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Rejected</p>
          <p className="mt-2 text-2xl font-semibold text-zinc-100">{summary.rejected}</p>
        </article>
      </div>

      <form className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-4">
        <label className="grid gap-1 text-xs text-zinc-400">
          Поиск
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="автор, текст комментария..."
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
            <option value="all">all</option>
            <option value="pending">pending</option>
            <option value="approved">approved</option>
            <option value="hidden">hidden</option>
            <option value="rejected">rejected</option>
          </select>
        </label>
        <div className="md:col-span-2 flex items-end">
          <button
            type="submit"
            className="h-10 rounded-lg bg-white px-4 text-sm font-semibold text-black transition hover:bg-zinc-200"
          >
            Применить фильтры
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-[0.12em] text-zinc-500">
            <tr>
              <th className="px-4 py-3">Комментарий</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3">Контент</th>
              <th className="px-4 py-3">Создан</th>
              <th className="px-4 py-3">Действия</th>
            </tr>
          </thead>
          <tbody>
            {comments.map((comment) => (
              <tr key={comment.id} className="border-b border-white/5 last:border-b-0 align-top">
                <td className="px-4 py-3">
                  <p className="font-medium text-zinc-100">{comment.authorDisplay}</p>
                  <p className="mt-1 line-clamp-3 text-xs leading-5 text-zinc-300">{comment.body}</p>
                  {comment.moderationReason ? (
                    <p className="mt-1 text-[11px] text-zinc-500">
                      reason: {comment.moderationReason}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full border px-2.5 py-1 text-xs ${statusBadge(comment.status)}`}>
                    {comment.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <p className="text-zinc-200">{comment.contentTitle}</p>
                  {comment.contentSlug ? (
                    <Link
                      href={`/streams/${comment.contentSlug}`}
                      target="_blank"
                      className="text-xs text-cyan-300 hover:text-cyan-200"
                    >
                      Открыть публичную страницу
                    </Link>
                  ) : (
                    <p className="text-xs text-zinc-500">slug не найден</p>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-300">{formatDateTime(comment.createdAt)}</td>
                <td className="px-4 py-3">
                  <CommentModerationForm
                    gate={gate}
                    commentId={comment.id}
                    contentSlug={comment.contentSlug}
                    defaultReason={comment.moderationReason}
                  />
                </td>
              </tr>
            ))}
            {comments.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                  Нет комментариев для выбранных фильтров.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
