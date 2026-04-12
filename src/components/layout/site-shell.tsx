import type { PropsWithChildren } from "react";
import { headers } from "next/headers";

import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { resolveAdminGateContext } from "@/server/auth/admin-gate";
import { resolveSupabasePrincipal } from "@/server/auth/supabase-auth";

export async function SiteShell({ children }: PropsWithChildren) {
  const host = (await headers()).get("host") ?? "";
  const [authResolution, adminGate] = await Promise.all([
    resolveSupabasePrincipal(),
    resolveAdminGateContext(host),
  ]);

  return (
    <div className="relative min-h-screen overflow-x-clip bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-28 top-10 h-[340px] w-[340px] rounded-full bg-cyan-500/20 blur-[120px]" />
        <div className="absolute right-0 top-[20%] h-[380px] w-[380px] rounded-full bg-indigo-500/20 blur-[160px]" />
        <div className="absolute bottom-[-100px] left-[30%] h-[360px] w-[360px] rounded-full bg-fuchsia-500/10 blur-[150px]" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <SiteHeader
          authState={{
            isSupabaseConfigured: Boolean(getSupabasePublicConfig()),
            isSignedIn: Boolean(authResolution.principal),
            principalEmail: authResolution.principal?.email ?? null,
            canAccessAdmin: adminGate.canAccessAdmin,
            adminMode: adminGate.mode,
          }}
        />
        <main className="flex-1 pt-10">{children}</main>
        <SiteFooter />
      </div>
    </div>
  );
}
