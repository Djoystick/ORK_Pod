"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  createSourceChannelAction,
  initialSourceActionState,
  syncAllSourcesAction,
  syncSourceChannelAction,
} from "@/app/admin/sources/actions";
import { AdminGateNotice } from "@/components/admin/admin-gate-notice";
import type { AdminGateContext } from "@/server/auth/admin-gate";
import type {
  ImportRun,
  IngestionLockSnapshot,
  Platform,
  ResolvedSourceChannel,
} from "@/types/content";

type SourceRegistryFormProps = {
  gate: AdminGateContext;
  platforms: Platform[];
  channels: ResolvedSourceChannel[];
  recentRuns: ImportRun[];
  lockSnapshot: IngestionLockSnapshot;
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

function SourceSyncForm({
  sourceId,
  syncMode,
  gate,
  disabled,
}: {
  sourceId: string;
  syncMode: "fresh" | "rerun";
  gate: AdminGateContext;
  disabled?: boolean;
}) {
  const [state, action, isPending] = useActionState(
    syncSourceChannelAction,
    initialSourceActionState,
  );

  const label = syncMode === "fresh" ? "Sync" : "Rerun";

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="sourceId" value={sourceId} />
      <input type="hidden" name="syncMode" value={syncMode} />
      {gate.requiresKeyForWrites ? (
        <input
          required
          name="bootstrapKey"
          type="password"
          placeholder="Bootstrap key"
          className="h-8 w-full rounded-lg border border-white/15 bg-black/30 px-2 text-xs text-zinc-100 outline-none transition focus:border-cyan-300/70"
        />
      ) : null}
      <button
        type="submit"
        disabled={!gate.canAccessAdmin || disabled || isPending}
        className="h-8 w-full rounded-lg border border-white/20 px-2 text-xs text-zinc-200 transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? `${label}...` : label}
      </button>
      {state.status !== "idle" ? (
        <p className={`text-[11px] ${state.status === "error" ? "text-rose-300" : "text-emerald-300"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function SourceRegistryForm({
  gate,
  platforms,
  channels,
  recentRuns,
  lockSnapshot,
}: SourceRegistryFormProps) {
  const [createState, createFormAction, isCreatePending] = useActionState(
    createSourceChannelAction,
    initialSourceActionState,
  );
  const [syncAllState, syncAllAction, isSyncAllPending] = useActionState(
    syncAllSourcesAction,
    initialSourceActionState,
  );

  const isDisabled = !gate.canAccessAdmin;
  const hasGlobalLock = Boolean(lockSnapshot.globalSyncAllLock);

  return (
    <section className="space-y-4">
      <AdminGateNotice gate={gate} />

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-2xl text-zinc-100">YouTube Sync Controls (V2)</h3>
            <p className="mt-1 text-sm text-zinc-300">
              Automation-ready flow: lock protection, rerun paths, import audit.
            </p>
          </div>
          <form action={syncAllAction} className="flex flex-wrap items-center gap-2">
            {gate.requiresKeyForWrites ? (
              <input
                required
                name="bootstrapKey"
                type="password"
                placeholder="Bootstrap key"
                className="h-10 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-300/70"
              />
            ) : null}
            <button
              type="submit"
              disabled={isDisabled || isSyncAllPending || hasGlobalLock}
              className="h-10 rounded-lg bg-cyan-300 px-4 text-sm font-semibold text-black transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSyncAllPending ? "Sync..." : "Sync all active"}
            </button>
          </form>
        </div>

        {hasGlobalLock ? (
          <p className="mt-3 rounded-xl border border-cyan-300/40 bg-cyan-300/10 px-3 py-2 text-sm text-cyan-100">
            Выполняется Sync All: {lockSnapshot.globalSyncAllLock?.id}
          </p>
        ) : null}

        {syncAllState.status !== "idle" ? (
          <div
            className={`mt-3 rounded-xl border p-3 text-sm ${
              syncAllState.status === "success"
                ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100"
                : "border-rose-300/40 bg-rose-300/10 text-rose-100"
            }`}
          >
            {syncAllState.message}
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h3 className="font-display text-2xl text-zinc-100">Создать source channel</h3>
        <p className="mt-2 text-sm text-zinc-300">
          Реестр используется как база для multi-channel ingestion.
        </p>

        <form action={createFormAction} className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm text-zinc-300">
            Название *
            <input
              required
              name="title"
              placeholder="orkcut"
              className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-zinc-100 outline-none transition focus:border-cyan-300/70"
            />
          </label>

          <label className="grid gap-2 text-sm text-zinc-300">
            Slug *
            <input
              required
              name="slug"
              placeholder="orkcut"
              className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-zinc-100 outline-none transition focus:border-cyan-300/70"
            />
          </label>

          <label className="grid gap-2 text-sm text-zinc-300">
            Платформа *
            <select
              required
              name="platform"
              className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-zinc-100 outline-none transition focus:border-cyan-300/70"
            >
              {platforms.map((platform) => (
                <option key={platform.id} value={platform.slug}>
                  {platform.title}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm text-zinc-300">
            External channel id
            <input
              name="externalChannelId"
              placeholder="@orkcut или UC..."
              className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-zinc-100 outline-none transition focus:border-cyan-300/70"
            />
          </label>

          <label className="grid gap-2 text-sm text-zinc-300 md:col-span-2">
            Channel URL
            <input
              name="sourceUrl"
              type="url"
              placeholder="https://www.youtube.com/@orkcut/videos"
              className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-zinc-100 outline-none transition focus:border-cyan-300/70"
            />
          </label>

          <label className="grid gap-2 text-sm text-zinc-300 md:col-span-2">
            Notes
            <textarea
              name="notes"
              rows={3}
              placeholder="Комментарий для ingestion-настроек"
              className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-zinc-100 outline-none transition focus:border-cyan-300/70"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-zinc-300 md:col-span-2">
            <input
              type="checkbox"
              name="isActive"
              value="true"
              defaultChecked
              className="size-4 rounded border border-white/20 bg-black/30"
            />
            Active
          </label>

          {gate.requiresKeyForWrites ? (
            <label className="grid gap-2 text-sm text-zinc-300 md:col-span-2">
              Bootstrap ключ *
              <input
                required
                name="bootstrapKey"
                type="password"
                className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-zinc-100 outline-none transition focus:border-cyan-300/70"
              />
            </label>
          ) : null}

          {createState.status !== "idle" ? (
            <div
              className={`rounded-xl border p-3 text-sm md:col-span-2 ${
                createState.status === "success"
                  ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100"
                  : "border-rose-300/40 bg-rose-300/10 text-rose-100"
              }`}
            >
              {createState.message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isDisabled || isCreatePending}
            className="h-11 rounded-xl bg-white px-4 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60 md:col-span-2"
          >
            {isCreatePending ? "Сохранение..." : "Добавить источник"}
          </button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-[0.12em] text-zinc-500">
            <tr>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Platform</th>
              <th className="px-4 py-3">URL / External ID</th>
              <th className="px-4 py-3">Last synced</th>
              <th className="px-4 py-3">Last success</th>
              <th className="px-4 py-3">Last error</th>
              <th className="px-4 py-3">State</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((channel) => (
              <tr key={channel.id} className="border-b border-white/5 align-top last:border-b-0">
                <td className="px-4 py-3 text-zinc-100">
                  <p className="font-medium">{channel.title}</p>
                  <p className="text-xs text-zinc-500">{channel.slug}</p>
                </td>
                <td className="px-4 py-3 text-zinc-300">{channel.platform.title}</td>
                <td className="px-4 py-3 text-zinc-300">
                  <p>{channel.externalChannelId ?? "—"}</p>
                  {channel.sourceUrl ? (
                    <a
                      href={channel.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block break-all underline underline-offset-2"
                    >
                      {channel.sourceUrl}
                    </a>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-zinc-300">{formatDateTime(channel.lastSyncedAt)}</td>
                <td className="px-4 py-3 text-zinc-300">
                  {formatDateTime(channel.lastSuccessfulSyncAt)}
                </td>
                <td className="px-4 py-3 text-zinc-300">
                  <p>{formatDateTime(channel.lastErrorAt)}</p>
                  {channel.lastErrorMessage ? (
                    <p className="mt-1 max-w-52 text-xs text-rose-300">{channel.lastErrorMessage}</p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-zinc-300">
                  {channel.isSyncInProgress ? (
                    <span className="rounded-full border border-cyan-300/40 bg-cyan-300/10 px-2 py-1 text-xs text-cyan-100">
                      in_progress
                    </span>
                  ) : (
                    <span className="rounded-full border border-zinc-400/40 bg-zinc-300/10 px-2 py-1 text-xs text-zinc-100">
                      idle
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="grid min-w-36 gap-2">
                    <SourceSyncForm
                      sourceId={channel.id}
                      syncMode="fresh"
                      gate={gate}
                      disabled={channel.isSyncInProgress}
                    />
                    <SourceSyncForm
                      sourceId={channel.id}
                      syncMode="rerun"
                      gate={gate}
                      disabled={channel.isSyncInProgress}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {channels.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-zinc-400">
                  В реестре пока нет каналов.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-2xl text-zinc-100">Последние import runs</h3>
          <Link
            href="/admin/imports"
            className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-white/40"
          >
            Открыть /admin/imports
          </Link>
        </div>
        <div className="mt-3 space-y-2">
          {recentRuns.slice(0, 8).map((run) => (
            <article
              key={run.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2"
            >
              <div className="text-sm text-zinc-200">
                <p className="font-medium">
                  {run.sourceChannelTitle} ({run.sourceChannelSlug})
                </p>
                <p className="text-xs text-zinc-400">
                  {formatDateTime(run.startedAt)} · trigger {run.trigger ?? "sync_source"} · created{" "}
                  {run.createdCount} · updated {run.updatedCount} · skipped {run.skippedCount} · failed{" "}
                  {run.failedCount}
                </p>
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-xs ${statusBadge(run.status)}`}>
                {run.status}
              </span>
            </article>
          ))}
          {recentRuns.length === 0 ? (
            <p className="text-sm text-zinc-400">История импортов пока пуста.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
