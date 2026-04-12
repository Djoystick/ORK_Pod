"use client";

import { useActionState } from "react";

import {
  initialModerationActionState,
  setCommentModerationAction,
} from "@/app/admin/moderation/actions";
import type { AdminGateContext } from "@/server/auth/admin-gate";
import type { CommentStatus } from "@/types/content";

type CommentModerationFormProps = {
  gate: AdminGateContext;
  commentId: string;
  contentSlug?: string | null;
  defaultReason?: string | null;
  compact?: boolean;
};

type ActionButtonProps = {
  status: CommentStatus;
  label: string;
  disabled: boolean;
};

function ActionButton({ status, label, disabled }: ActionButtonProps) {
  return (
    <button
      type="submit"
      name="status"
      value={status}
      disabled={disabled}
      className="rounded-lg border border-white/20 px-2.5 py-1 text-xs text-zinc-200 transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {label}
    </button>
  );
}

export function CommentModerationForm({
  gate,
  commentId,
  contentSlug,
  defaultReason,
  compact = true,
}: CommentModerationFormProps) {
  const [state, action, isPending] = useActionState(
    setCommentModerationAction,
    initialModerationActionState,
  );
  const disabled = !gate.canAccessAdmin || isPending;

  return (
    <form action={action} className={compact ? "space-y-2" : "space-y-3"}>
      <input type="hidden" name="commentId" value={commentId} />
      <input type="hidden" name="contentSlug" value={contentSlug ?? ""} />

      {gate.requiresKeyForWrites ? (
        <input
          required
          name="bootstrapKey"
          type="password"
          placeholder="Bootstrap key"
          className="h-8 w-full rounded-lg border border-white/15 bg-black/30 px-2 text-[11px] text-zinc-100 outline-none transition focus:border-cyan-300/70"
        />
      ) : null}

      <input
        name="moderationReason"
        defaultValue={defaultReason ?? ""}
        placeholder="Причина (опционально)"
        className="h-8 w-full rounded-lg border border-white/15 bg-black/30 px-2 text-[11px] text-zinc-100 outline-none transition focus:border-cyan-300/70"
      />

      <div className="flex flex-wrap gap-1.5">
        <ActionButton status="approved" label="Approve" disabled={disabled} />
        <ActionButton status="hidden" label="Hide" disabled={disabled} />
        <ActionButton status="rejected" label="Reject" disabled={disabled} />
      </div>

      {state.status !== "idle" ? (
        <p className={`text-[11px] ${state.status === "error" ? "text-rose-300" : "text-emerald-300"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
