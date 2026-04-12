import Link from "next/link";
import { headers } from "next/headers";

import { AdminGateNotice } from "@/components/admin/admin-gate-notice";
import { formatRuDate } from "@/lib/content";
import { getAdminContentListData } from "@/server/services/admin-content-service";

type AdminContentPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    sourceType?: string;
    platform?: string;
    category?: string;
  }>;
};

function statusBadge(status?: string) {
  if (status === "published") {
    return "border-emerald-400/40 bg-emerald-300/10 text-emerald-100";
  }
  if (status === "archived") {
    return "border-zinc-400/35 bg-zinc-400/10 text-zinc-200";
  }
  return "border-amber-400/40 bg-amber-300/10 text-amber-100";
}

export default async function AdminContentPage({ searchParams }: AdminContentPageProps) {
  const params = await searchParams;
  const host = (await headers()).get("host") ?? "";
  const { gate, filters, items, taxonomy } = await getAdminContentListData(host, params);

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">CMS</p>
        <h2 className="font-display text-3xl text-zinc-100">Контент</h2>
      </div>

      <AdminGateNotice gate={gate} />

      <form className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-5">
        <label className="grid gap-1 text-xs text-zinc-400">
          Поиск
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="заголовок, slug, категория..."
            className="h-10 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-300/70"
          />
        </label>
        <label className="grid gap-1 text-xs text-zinc-400">
          Статус
          <select
            name="status"
            defaultValue={filters.status}
            className="h-10 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-300/70"
          >
            <option value="all">Все</option>
            <option value="draft">draft</option>
            <option value="published">published</option>
            <option value="archived">archived</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs text-zinc-400">
          Source type
          <select
            name="sourceType"
            defaultValue={filters.sourceType}
            className="h-10 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-300/70"
          >
            <option value="all">Все</option>
            <option value="manual">manual</option>
            <option value="imported">imported</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs text-zinc-400">
          Платформа
          <select
            name="platform"
            defaultValue={filters.platform}
            className="h-10 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-300/70"
          >
            <option value="all">Все</option>
            {taxonomy.platforms.map((platform) => (
              <option key={platform.id} value={platform.slug}>
                {platform.title}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-zinc-400">
          Категория
          <select
            name="category"
            defaultValue={filters.category}
            className="h-10 rounded-lg border border-white/15 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-cyan-300/70"
          >
            <option value="all">Все</option>
            {taxonomy.categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.title}
              </option>
            ))}
          </select>
        </label>
        <div className="md:col-span-5">
          <button
            type="submit"
            className="h-10 rounded-lg bg-white px-4 text-sm font-semibold text-black transition hover:bg-zinc-200"
          >
            Применить фильтры
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <p className="text-sm text-zinc-300">
          Найдено: <span className="font-semibold text-zinc-100">{items.length}</span>
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-[0.12em] text-zinc-500">
            <tr>
              <th className="px-4 py-3">Заголовок</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3">Источник</th>
              <th className="px-4 py-3">Категория</th>
              <th className="px-4 py-3">Платформа</th>
              <th className="px-4 py-3">Дата</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-white/5 last:border-b-0">
                <td className="px-4 py-3">
                  <p className="font-medium text-zinc-100">{item.title}</p>
                  <p className="text-xs text-zinc-500">{item.slug}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full border px-2.5 py-1 text-xs ${statusBadge(item.status)}`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-300">{item.sourceType}</td>
                <td className="px-4 py-3 text-zinc-300">{item.category.title}</td>
                <td className="px-4 py-3 text-zinc-300">{item.platform.title}</td>
                <td className="px-4 py-3 text-zinc-300">{formatRuDate(item.publishedAt)}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/content/${item.id}`}
                    className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-white/35"
                  >
                    Редактировать
                  </Link>
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                  Ничего не найдено по текущим фильтрам.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
