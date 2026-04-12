import type { PropsWithChildren } from "react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export function SiteShell({ children }: PropsWithChildren) {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-28 top-10 h-[340px] w-[340px] rounded-full bg-cyan-500/20 blur-[120px]" />
        <div className="absolute right-0 top-[20%] h-[380px] w-[380px] rounded-full bg-indigo-500/20 blur-[160px]" />
        <div className="absolute bottom-[-100px] left-[30%] h-[360px] w-[360px] rounded-full bg-fuchsia-500/10 blur-[150px]" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1 pt-10">{children}</main>
        <SiteFooter />
      </div>
    </div>
  );
}
