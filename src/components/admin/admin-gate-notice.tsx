import type { AdminGateContext } from "@/server/auth/admin-gate";

type AdminGateNoticeProps = {
  gate: AdminGateContext;
};

export function AdminGateNotice({ gate }: AdminGateNoticeProps) {
  return (
    <div
      className={`rounded-xl border p-4 text-sm ${
        gate.canAccessAdmin
          ? "border-amber-300/30 bg-amber-200/10 text-amber-100"
          : "border-rose-300/40 bg-rose-300/10 text-rose-100"
      }`}
    >
      <p className="font-semibold">Admin access model</p>
      <p className="mt-1">{gate.message}</p>
      <p className="mt-2 text-xs opacity-80">
        strategy: {gate.strategy} · mode: {gate.mode}
      </p>
      {gate.principal ? (
        <p className="text-xs opacity-80">
          principal: {gate.principal.email ?? gate.principal.userId}
        </p>
      ) : null}
    </div>
  );
}
