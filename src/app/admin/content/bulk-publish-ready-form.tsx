"use client";

import { useActionState } from "react";

import {
  bulkPublishReadyContentAction,
  type BulkPublishReadyActionState,
} from "@/app/admin/content/[id]/actions";
import type { AdminGateContext } from "@/server/auth/admin-gate";

const INITIAL_BULK_PUBLISH_ACTION_STATE: BulkPublishReadyActionState = {
  status: "idle",
  message: "",
};

type BulkPublishReadyFormProps = {
  gate: AdminGateContext;
  summary: {
    draftCount: number;
    readyDraftCount: number;
    blockedDraftCount: number;
    filteredReadyCount: number;
  };
};

export function BulkPublishReadyForm({ gate, summary }: BulkPublishReadyFormProps) {
  const [state, action, pending] = useActionState(
    bulkPublishReadyContentAction,
    INITIAL_BULK_PUBLISH_ACTION_STATE,
  );

  const canRun = gate.canAccessAdmin && summary.readyDraftCount > 0;

  return (
    <section className="space-y-3 rounded-2xl border border-emerald-300/25 bg-emerald-400/[0.06] p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-emerald-200">Bulk publish</p>
      <h3 className="font-display text-2xl text-zinc-100">Публикация publish-ready записей</h3>
      <p className="text-sm text-zinc-300">
        Действие публикует только те draft-элементы, которые проходят обязательные readiness
        проверки.
      </p>
      <p className="text-xs text-zinc-300">
        draft: <span className="font-semibold text-zinc-100">{summary.draftCount}</span> · ready:{" "}
        <span className="font-semibold text-emerald-200">{summary.readyDraftCount}</span> · blocked:{" "}
        <span className="font-semibold text-amber-200">{summary.blockedDraftCount}</span> · ready в текущем
        фильтре: <span className="font-semibold text-zinc-100">{summary.filteredReadyCount}</span>
      </p>

      <form action={action} className="flex flex-wrap items-end gap-3">
        {gate.requiresKeyForWrites ? (
          <label className="grid gap-1 text-xs text-zinc-300">
            Bootstrap key
            <input
              name="bootstrapKey"
              type="password"
              required
              className="h-10 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-emerald-300/70"
            />
          </label>
        ) : null}

        <button
          type="submit"
          disabled={!canRun || pending}
          className="h-10 rounded-lg bg-white px-4 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Публикуем..." : `Опубликовать ready (${summary.readyDraftCount})`}
        </button>
      </form>

      {!canRun ? (
        <p className="text-xs text-zinc-400">
          Сейчас нет publish-ready draft записей для безопасного bulk publish.
        </p>
      ) : null}

      {state.status !== "idle" ? (
        <p className={`text-sm ${state.status === "error" ? "text-rose-300" : "text-emerald-300"}`}>
          {state.message}
        </p>
      ) : null}
    </section>
  );
}
