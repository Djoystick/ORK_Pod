import { headers } from "next/headers";

import { ManualContentForm } from "@/app/admin/new/manual-content-form";
import { getAdminCreateFormData } from "@/server/services/admin-content-service";

export const metadata = {
  title: "Admin · Создать запись",
  description: "Временная форма ручного создания контента для ORKPOD Archive.",
};

export default async function AdminNewPage() {
  const host = (await headers()).get("host") ?? "";
  const formData = await getAdminCreateFormData(host);

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Manual Flow</p>
        <h2 className="font-display text-3xl text-zinc-100">Создать новую запись</h2>
      </div>

      <ManualContentForm
        gate={formData.gate}
        categories={formData.categories}
        series={formData.series}
        platforms={formData.platforms}
      />
    </section>
  );
}
