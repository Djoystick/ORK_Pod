"use client";

import { useActionState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  addCommentAction,
  setCommentFeedbackAction,
  setReactionAction,
  type CommunityCommentActionState,
  type CommunityCommentFeedbackActionState,
  type CommunityReactionActionState,
} from "@/app/streams/[slug]/community-actions";
import type { CommentRecord, CommunityReactionSummary, ReactionType } from "@/types/content";

const INITIAL_COMMUNITY_REACTION_ACTION_STATE: CommunityReactionActionState = {
  status: "idle",
  message: "",
};

const INITIAL_COMMUNITY_COMMENT_ACTION_STATE: CommunityCommentActionState = {
  status: "idle",
  message: "",
};

const INITIAL_COMMUNITY_COMMENT_FEEDBACK_ACTION_STATE: CommunityCommentFeedbackActionState = {
  status: "idle",
  message: "",
};

type CommunityBlockProps = {
  slug: string;
  comments: CommentRecord[];
  reactionSummary: CommunityReactionSummary;
  initialDisplayName: string;
  policyMessage: string;
  communityWrite: {
    canWrite: boolean;
    requiresAuth: boolean;
    writeMode: "guest_local" | "supabase_auth_required";
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
  const signInHref = `/auth/sign-in?next=${encodeURIComponent(`/streams/${slug}`)}`;
  const [reactionState, reactionAction, reactionPending] = useActionState(
    setReactionAction,
    INITIAL_COMMUNITY_REACTION_ACTION_STATE,
  );
  const [commentState, commentAction, commentPending] = useActionState(
    addCommentAction,
    INITIAL_COMMUNITY_COMMENT_ACTION_STATE,
  );
  const [commentFeedbackState, commentFeedbackAction, commentFeedbackPending] = useActionState(
    setCommentFeedbackAction,
    INITIAL_COMMUNITY_COMMENT_FEEDBACK_ACTION_STATE,
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

  useEffect(() => {
    if (commentFeedbackState.status === "success") {
      router.refresh();
    }
  }, [commentFeedbackState.status, router]);

  const commentsCountLabel = useMemo(() => {
    if (comments.length === 0) return "Пока нет одобренных комментариев.";
    if (comments.length === 1) return "1 комментарий";
    return `${comments.length} комментариев`;
  }, [comments.length]);
  const isGuestMode = communityWrite.writeMode === "guest_local";

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
                  ? "border-emerald-300/55 bg-emerald-300/20 text-emerald-100"
                  : "border-white/15 bg-white/5 text-zinc-200 hover:border-emerald-300/45"
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
        {!communityWrite.canWrite && communityWrite.requiresAuth ? (
          <p className="text-xs text-amber-300">
            Реакции доступны только после авторизации в текущем write-режиме.{" "}
            <Link href={signInHref} className="underline hover:text-amber-200">
              Войти
            </Link>
            .
          </p>
        ) : null}
        {!communityWrite.canWrite && !communityWrite.requiresAuth ? (
          <p className="text-xs text-amber-300">
            Реакции временно доступны только для чтения в текущей конфигурации.
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
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
                  <form action={commentFeedbackAction} className="flex items-center gap-2">
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="commentId" value={comment.id} />
                    <button
                      type="submit"
                      name="feedbackType"
                      value="up"
                      disabled={commentFeedbackPending || !communityWrite.canWrite}
                      className={`rounded-full border px-2.5 py-1 text-xs transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        comment.feedbackSummary?.activeFeedbackType === "up"
                          ? "border-emerald-300/55 bg-emerald-300/20 text-emerald-100"
                          : "border-white/15 bg-white/5 text-zinc-300 hover:border-emerald-300/45"
                      }`}
                    >
                      + {comment.feedbackSummary?.up ?? 0}
                    </button>
                    <button
                      type="submit"
                      name="feedbackType"
                      value="down"
                      disabled={commentFeedbackPending || !communityWrite.canWrite}
                      className={`rounded-full border px-2.5 py-1 text-xs transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        comment.feedbackSummary?.activeFeedbackType === "down"
                          ? "border-rose-300/55 bg-rose-300/20 text-rose-100"
                          : "border-white/15 bg-white/5 text-zinc-300 hover:border-rose-300/45"
                      }`}
                    >
                      - {comment.feedbackSummary?.down ?? 0}
                    </button>
                  </form>
                  <p className="text-xs text-zinc-400">Баланс: {comment.feedbackSummary?.score ?? 0}</p>
                </div>
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
          {isGuestMode ? (
            <label className="grid gap-1 text-xs text-zinc-400">
              Имя (временная identity в fallback-режиме)
              <input
                name="displayName"
                defaultValue={initialDisplayName}
                maxLength={48}
                required
                className="h-10 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-emerald-300/80"
              />
            </label>
          ) : (
            <p className="text-xs text-zinc-400">
              Комментарий будет отправлен от имени авторизованного аккаунта Supabase.
            </p>
          )}
          <label className="grid gap-1 text-xs text-zinc-400">
            Комментарий
            <textarea
              name="body"
              required
              minLength={3}
              maxLength={1200}
              rows={4}
              placeholder="Поделитесь мыслью по выпуску..."
              className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-emerald-300/80"
            />
          </label>
          <button
            type="submit"
            disabled={commentPending || !communityWrite.canWrite}
            className="h-10 rounded-lg bg-emerald-300 px-4 text-sm font-semibold text-[#062515] transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {commentPending ? "Отправка..." : "Отправить комментарий"}
          </button>
          {!communityWrite.canWrite && communityWrite.requiresAuth ? (
            <p className="text-xs text-amber-300">
              Отправка комментариев отключена до выполнения требований write-доступа.{" "}
              <Link href={signInHref} className="underline hover:text-amber-200">
                Войти
              </Link>
              .
            </p>
          ) : null}
          {!communityWrite.canWrite && !communityWrite.requiresAuth ? (
            <p className="text-xs text-amber-300">
              Отправка комментариев временно отключена в текущей конфигурации.
            </p>
          ) : null}
          {commentState.status !== "idle" ? (
            <p className={`text-xs ${commentState.status === "error" ? "text-rose-300" : "text-emerald-300"}`}>
              {commentState.message}
            </p>
          ) : null}
          {commentFeedbackState.status !== "idle" ? (
            <p
              className={`text-xs ${
                commentFeedbackState.status === "error" ? "text-rose-300" : "text-emerald-300"
              }`}
            >
              {commentFeedbackState.message}
            </p>
          ) : null}
        </form>
      </div>
    </section>
  );
}
