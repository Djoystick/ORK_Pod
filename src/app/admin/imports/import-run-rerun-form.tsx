"use client";

import { useActionState } from "react";

import {
  initialImportActionState,
  rerunImportRunAction,
} from "@/app/admin/imports/actions";
import type { AdminGateContext } from "@/server/auth/admin-gate";

type ImportRunRerunFormProps = {
  gate: AdminGateContext;
  runId: string;
  compact?: boolean;
};

export function ImportRunRerunForm({
  gate,
  runId,
  compact = false,
}: ImportRunRerunFormProps) {
  const [state, action, isPending] = useActionState(
    rerunImportRunAction,
    initialImportActionState,
  );

  return (
    <form action={action} className={compact ? "space-y-1" : "space-y-2"}>
      <input type="hidden" name="runId" value={runId} />
      {gate.requiresKeyForWrites ? (
        <input
          required
          name="bootstrapKey"
          type="password"
          placeholder="Bootstrap key"
          className={`rounded-lg border border-white/15 bg-black/30 text-zinc-100 outline-none transition focus:border-cyan-300/70 ${
            compact ? "h-8 w-32 px-2 text-[11px]" : "h-9 w-full px-2 text-xs"
          }`}
        />
      ) : null}
      <button
        type="submit"
        disabled={!gate.canAccessAdmin || isPending}
        className={`rounded-lg border border-white/20 text-zinc-200 transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-60 ${
          compact ? "h-8 px-3 text-[11px]" : "h-9 w-full px-2 text-xs"
        }`}
      >
        {isPending ? "Rerun..." : "Rerun source"}
      </button>
      {state.status !== "idle" ? (
        <p className={`text-[11px] ${state.status === "error" ? "text-rose-300" : "text-emerald-300"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
