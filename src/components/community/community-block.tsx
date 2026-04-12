"use client";

import { useActionState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

import {
  addCommentAction,
  initialCommunityCommentActionState,
  initialCommunityReactionActionState,
  setReactionAction,
} from "@/app/streams/[slug]/community-actions";
import type { CommentRecord, CommunityReactionSummary, ReactionType } from "@/types/content";

type CommunityBlockProps = {
  slug: string;
  comments: CommentRecord[];
  reactionSummary: CommunityReactionSummary;
  initialDisplayName: string;
  policyMessage: string;
  communityWrite: {
    canWrite: boolean;
    requiresAuth: boolean;
  };
};

const reactionLabels: Record<ReactionType, string> = {
  like: "👍 Полезно",
  love: "❤️ Поддержка",
  insight: "💡 Инсайт",
  fire: "🔥 Жарко",
};

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

export function CommunityBlock({
  slug,
  comments,
  reactionSummary,
  initialDisplayName,
  policyMessage,
  communityWrite,
}: CommunityBlockProps) {
  const router = useRouter();
  const [reactionState, reactionAction, reactionPending] = useActionState(
    setReactionAction,
    initialCommunityReactionActionState,
  );
  const [commentState, commentAction, commentPending] = useActionState(
    addCommentAction,
    initialCommunityCommentActionState,
  );

  useEffect(() => {
    if (reactionState.status === "success") {
      router.refresh();
    }
  }, [reactionState.status, router]);

  useEffect(() => {
    if (commentState.status === "success") {
      router.refresh();
    }
  }, [commentState.status, router]);

  const commentsCountLabel = useMemo(() => {
    if (comments.length === 0) return "Пока нет одобренных комментариев.";
    if (comments.length === 1) return "1 комментарий";
    return `${comments.length} комментариев`;
  }, [comments.length]);

  return (
    <section className="space-y-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Community</p>
        <h2 className="font-display text-3xl text-zinc-100">Комментарии и реакции</h2>
        <p className="mt-2 text-sm text-zinc-400">{policyMessage}</p>
      </div>

      <div className="space-y-3 rounded-xl border border-white/10 bg-black/25 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-zinc-100">Реакции</h3>
          <span className="text-xs text-zinc-400">Всего: {reactionSummary.total}</span>
        </div>
        <form action={reactionAction} className="flex flex-wrap gap-2">
          <input type="hidden" name="slug" value={slug} />
          {reactionSummary.items.map((item) => (
            <button
              key={item.reactionType}
              type="submit"
              name="reactionType"
              value={item.reactionType}
              disabled={reactionPending || !communityWrite.canWrite}
              className={`rounded-full border px-3 py-1.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                item.reactedByCurrentUser
                  ? "border-cyan-300/50 bg-cyan-300/20 text-cyan-100"
                  : "border-white/15 bg-white/5 text-zinc-200 hover:border-white/30"
              }`}
            >
              {reactionLabels[item.reactionType]} · {item.count}
            </button>
          ))}
        </form>
        {reactionState.status !== "idle" ? (
          <p className={`text-xs ${reactionState.status === "error" ? "text-rose-300" : "text-emerald-300"}`}>
            {reactionState.message}
          </p>
        ) : null}
        {!communityWrite.canWrite ? (
          <p className="text-xs text-amber-300">
            Реакции доступны только после авторизации в текущем write-режиме.
          </p>
        ) : null}
      </div>

      <div className="space-y-4 rounded-xl border border-white/10 bg-black/25 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-zinc-100">Комментарии</h3>
          <span className="text-xs text-zinc-400">{commentsCountLabel}</span>
        </div>

        {comments.length > 0 ? (
          <ul className="space-y-3">
            {comments.map((comment) => (
              <li key={comment.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-zinc-100">{comment.authorDisplay}</p>
                  <p className="text-xs text-zinc-500">{formatDateTime(comment.createdAt)}</p>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{comment.body}</p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed border-white/15 bg-transparent p-4 text-sm text-zinc-400">
            Пока комментариев нет. Можно оставить первый отзыв.
          </div>
        )}

        <form action={commentAction} className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <input type="hidden" name="slug" value={slug} />
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            className="hidden"
            aria-hidden="true"
          />
          <label className="grid gap-1 text-xs text-zinc-400">
            Имя (временная identity в fallback-режиме)
            <input
              name="displayName"
              defaultValue={initialDisplayName}
              maxLength={48}
              required
              className="h-10 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-300/70"
            />
          </label>
          <label className="grid gap-1 text-xs text-zinc-400">
            Комментарий
            <textarea
              name="body"
              required
              minLength={3}
              maxLength={1200}
              rows={4}
              placeholder="Поделитесь мыслью по выпуску..."
              className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-cyan-300/70"
            />
          </label>
          <button
            type="submit"
            disabled={commentPending || !communityWrite.canWrite}
            className="h-10 rounded-lg bg-white px-4 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {commentPending ? "Отправка..." : "Отправить комментарий"}
          </button>
          {!communityWrite.canWrite ? (
            <p className="text-xs text-amber-300">
              Отправка комментариев отключена до выполнения требований write-доступа.
            </p>
          ) : null}
          {commentState.status !== "idle" ? (
            <p className={`text-xs ${commentState.status === "error" ? "text-rose-300" : "text-emerald-300"}`}>
              {commentState.message}
            </p>
          ) : null}
        </form>
      </div>
    </section>
  );
}
