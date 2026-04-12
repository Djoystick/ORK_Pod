import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";

import { SignInForm } from "@/app/auth/sign-in/sign-in-form";
import { Container } from "@/components/shared/container";
import { sanitizeInternalRedirect } from "@/lib/redirect";
import { resolveAdminGateContext } from "@/server/auth/admin-gate";
import { resolveSupabasePrincipal } from "@/server/auth/supabase-auth";

export const metadata: Metadata = {
  title: "Вход",
  description: "Вход в ORKPOD Archive через Supabase Auth.",
};

type SignInPageProps = {
  searchParams: Promise<{
    next?: string;
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const host = (await headers()).get("host") ?? "";
  const nextPath = sanitizeInternalRedirect(params.next, "/");

  const [authResolution, gate] = await Promise.all([
    resolveSupabasePrincipal(),
    resolveAdminGateContext(host),
  ]);

  const principal = authResolution.principal;

  return (
    <Container className="space-y-6 pb-16">
      <section className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Auth</p>
        <h1 className="font-display text-4xl text-zinc-100">Вход в ORKPOD</h1>
        <p className="max-w-2xl text-sm text-zinc-300">
          Используется production-направленный путь Supabase Auth. После входа станут доступны
          проверка community write-потоков и, при наличии прав, admin write-функции.
        </p>
      </section>

      {principal ? (
        <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-sm text-zinc-300">
            Сессия активна: <span className="font-semibold text-zinc-100">{principal.email ?? principal.userId}</span>
          </p>
          <p
            className={`text-sm ${
              gate.canAccessAdmin ? "text-emerald-300" : "text-amber-300"
            }`}
          >
            {gate.canAccessAdmin
              ? "Admin-доступ подтвержден. Можно переходить к управлению контентом."
              : "Пользователь вошел, но admin-доступ не открыт. Добавьте аккаунт в allowlist или в таблицу admin_users."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={nextPath}
              className="inline-flex h-10 items-center rounded-lg border border-white/20 px-4 text-sm text-zinc-200 transition hover:border-white/35"
            >
              Вернуться к странице
            </Link>
            <Link
              href="/admin"
              className="inline-flex h-10 items-center rounded-lg bg-white px-4 text-sm font-semibold text-black transition hover:bg-zinc-200"
            >
              Открыть /admin
            </Link>
          </div>
          <p className="text-xs text-zinc-400">{gate.message}</p>
        </section>
      ) : (
        <SignInForm nextPath={nextPath} />
      )}
    </Container>
  );
}

