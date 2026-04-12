"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";
import { Container } from "@/components/shared/container";

const navigationItems = [
  { href: "/", label: "Главная" },
  { href: "/streams", label: "Архив" },
  { href: "/about", label: "О проекте" },
  { href: "/admin", label: "Admin" },
];

export function SiteHeader() {
  const pathname = usePathname();

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

        <nav className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
          {navigationItems.map((item) => {
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full px-4 py-2 text-sm transition",
                  active
                    ? "bg-white text-black"
                    : "text-zinc-300 hover:text-white",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </Container>
    </header>
  );
}
