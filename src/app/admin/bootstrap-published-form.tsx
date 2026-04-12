"use client";

import { useActionState } from "react";

import {
  bootstrapPublishedContentAction,
  initialBootstrapPublishedActionState,
} from "@/app/admin/actions";
import type { AdminGateContext } from "@/server/auth/admin-gate";

type BootstrapPublishedFormProps = {
  gate: AdminGateContext;
  publishedCount: number;
};

export function BootstrapPublishedForm({
  gate,
  publishedCount,
}: BootstrapPublishedFormProps) {
  const [state, action, pending] = useActionState(
    bootstrapPublishedContentAction,
    initialBootstrapPublishedActionState,
  );

  const canBootstrap = gate.canAccessAdmin;

  return (
    <section className="space-y-3 rounded-2xl border border-cyan-300/20 bg-cyan-400/5 p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-cyan-200">Live bootstrap</p>
      <h2 className="font-display text-2xl text-zinc-100">Первые опубликованные записи</h2>
      <p className="text-sm text-zinc-300">
        Быстрый owner-only bootstrap стартовых публикаций в live БД, чтобы сразу проверить
        публичные detail-страницы, comments и reactions.
      </p>
      <p className="text-xs text-zinc-400">Сейчас опубликовано: {publishedCount}</p>

      <form action={action} className="flex flex-wrap items-end gap-3">
        {gate.requiresKeyForWrites ? (
          <label className="grid gap-1 text-xs text-zinc-400">
            Bootstrap key
            <input
              name="bootstrapKey"
              type="password"
              required
              className="h-10 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-300/70"
            />
          </label>
        ) : null}

        <button
          type="submit"
          disabled={!canBootstrap || pending}
          className="h-10 rounded-lg bg-white px-4 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Выполняем..." : "Bootstrap published"}
        </button>
      </form>

      {state.status !== "idle" ? (
        <p className={`text-sm ${state.status === "error" ? "text-rose-300" : "text-emerald-300"}`}>
          {state.message}
        </p>
      ) : null}
    </section>
  );
}

