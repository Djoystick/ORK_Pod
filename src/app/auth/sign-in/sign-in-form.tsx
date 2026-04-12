"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { signInAction, type SignInActionState } from "@/app/auth/actions";

const INITIAL_SIGN_IN_ACTION_STATE: SignInActionState = {
  status: "idle",
  message: "",
};

type SignInFormProps = {
  nextPath: string;
};

export function SignInForm({ nextPath }: SignInFormProps) {
  const router = useRouter();
  const [state, action, pending] = useActionState(signInAction, INITIAL_SIGN_IN_ACTION_STATE);

  useEffect(() => {
    if (state.status === "success" && state.redirectTo) {
      router.push(state.redirectTo);
      router.refresh();
    }
  }, [router, state.redirectTo, state.status]);

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <input type="hidden" name="next" value={nextPath} />

      <label className="grid gap-1 text-xs text-zinc-400">
        Email
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-300/70"
        />
      </label>

      <label className="grid gap-1 text-xs text-zinc-400">
        Пароль
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-300/70"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-xl bg-white px-4 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Входим..." : "Войти"}
      </button>

      {state.status !== "idle" ? (
        <p className={`text-sm ${state.status === "error" ? "text-rose-300" : "text-emerald-300"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
