import Link from "next/link";
import { headers } from "next/headers";

import { EditContentForm } from "@/app/admin/content/[id]/edit-content-form";
import { AdminGateNotice } from "@/components/admin/admin-gate-notice";
import { getAdminContentEditData } from "@/server/services/admin-content-service";

type AdminContentEditPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminContentEditPage({ params }: AdminContentEditPageProps) {
  const { id } = await params;
  const host = (await headers()).get("host") ?? "";
  const data = await getAdminContentEditData(host, id);

  if (!data.item) {
    return (
      <section className="space-y-4">
        <AdminGateNotice gate={data.gate} />
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="font-display text-3xl text-zinc-100">Запись не найдена</h2>
          <p className="mt-2 text-sm text-zinc-300">
            Проверьте идентификатор записи или вернитесь к списку контента.
          </p>
          <Link
            href="/admin/content"
            className="mt-4 inline-flex rounded-xl border border-white/20 px-4 py-2 text-sm text-zinc-100 transition hover:border-white/35"
          >
            Вернуться к списку
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">CMS Editor</p>
        <h2 className="font-display text-3xl text-zinc-100">Редактирование записи</h2>
      </div>

      <EditContentForm
        gate={data.gate}
        item={data.item}
        categories={data.taxonomy.categories}
        series={data.taxonomy.series}
        platforms={data.taxonomy.platforms}
        initialExternalUrl={data.initialExternalUrl}
      />
    </section>
  );
}
