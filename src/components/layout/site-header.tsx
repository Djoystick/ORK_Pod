"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOutAction } from "@/app/auth/actions";
import { cn } from "@/lib/cn";
import { Container } from "@/components/shared/container";

const navigationItems = [
  { href: "/", label: "Главная" },
  { href: "/streams", label: "Архив" },
  { href: "/about", label: "О проекте" },
  { href: "/admin", label: "Admin" },
];

type SiteHeaderAuthState = {
  isSupabaseConfigured: boolean;
  isSignedIn: boolean;
  principalEmail: string | null;
  canAccessAdmin: boolean;
  adminMode: string;
};

type SiteHeaderProps = {
  authState: SiteHeaderAuthState;
};

export function SiteHeader({ authState }: SiteHeaderProps) {
  const pathname = usePathname();
  const currentPath = pathname || "/";
  const signInHref = `/auth/sign-in?next=${encodeURIComponent(currentPath)}`;

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070a12]/85 backdrop-blur-xl">
      <Container className="flex h-18 items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-indigo-500 text-sm font-semibold text-black">
            OP
          </div>
          <div>
            <p className="font-display text-sm uppercase tracking-[0.22em] text-zinc-300">
              Orkpod
            </p>
            <p className="text-xs text-zinc-500">Video Archive</p>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1 md:flex">
            {navigationItems.map((item) => {
              const active = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-full px-4 py-2 text-sm transition",
                    active ? "bg-white text-black" : "text-zinc-300 hover:text-white",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <span
            className={cn(
              "hidden rounded-full border px-3 py-1 text-xs lg:inline-flex",
              authState.canAccessAdmin
                ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
                : "border-zinc-400/40 bg-zinc-500/10 text-zinc-300",
            )}
            title={`Admin mode: ${authState.adminMode}`}
          >
            {authState.canAccessAdmin ? "Admin доступ" : "Admin ограничен"}
          </span>

          {!authState.isSupabaseConfigured ? (
            <span className="hidden rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs text-amber-100 lg:inline-flex">
              Auth не настроен
            </span>
          ) : null}

          {authState.isSignedIn ? (
            <div className="flex items-center gap-2">
              <span className="hidden max-w-[180px] truncate text-xs text-zinc-300 sm:inline">
                {authState.principalEmail ?? "Авторизован"}
              </span>
              <form action={signOutAction}>
                <input type="hidden" name="redirectTo" value={currentPath} />
                <button
                  type="submit"
                  className="h-9 rounded-full border border-white/20 px-4 text-sm text-zinc-200 transition hover:border-white/35 hover:text-white"
                >
                  Выйти
                </button>
              </form>
            </div>
          ) : (
            <Link
              href={signInHref}
              className="inline-flex h-9 items-center rounded-full bg-white px-4 text-sm font-semibold text-black transition hover:bg-zinc-200"
            >
              Войти
            </Link>
          )}
        </div>
      </Container>
    </header>
  );
}

