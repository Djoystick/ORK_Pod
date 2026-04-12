import { headers } from "next/headers";

import { SourceRegistryForm } from "@/app/admin/sources/source-registry-form";
import { getAdminSourceRegistryData } from "@/server/services/admin-source-service";

export const metadata = {
  title: "Admin · Source Registry",
  description: "Реестр источников, lock-state и ручной YouTube ingestion.",
};

export default async function AdminSourcesPage() {
  const host = (await headers()).get("host") ?? "";
  const data = await getAdminSourceRegistryData(host);

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Source Registry V1</p>
        <h2 className="font-display text-3xl text-zinc-100">
          Реестр каналов и ручной ingestion
        </h2>
      </div>

      <SourceRegistryForm
        gate={data.gate}
        platforms={data.platforms}
        channels={data.channels}
        recentRuns={data.recentRuns}
        lockSnapshot={data.lockSnapshot}
      />
    </section>
  );
}
