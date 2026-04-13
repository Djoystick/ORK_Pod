import { ImportedDescription } from "@/components/archive/imported-description";
import type { ResolvedContentItem } from "@/types/content";

type DetailDescriptionPanelProps = {
  item: ResolvedContentItem;
};

export function DetailDescriptionPanel({ item }: DetailDescriptionPanelProps) {
  const text = item.sourceType === "imported" ? item.body?.trim() || item.description : item.description;

  if (!text.trim()) {
    return null;
  }

  return (
    <article className="rounded-3xl border border-white/10 bg-[#0a1410]/85 p-5 sm:p-6">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <div>
            <h2 className="font-display text-2xl text-zinc-100">Описание</h2>
            <p className="mt-1 text-xs text-zinc-400">
              Разверните блок, чтобы прочитать полное описание выпуска.
            </p>
          </div>
          <span className="rounded-full border border-white/20 px-3 py-1 text-xs text-zinc-300 transition group-open:border-emerald-300/45 group-open:text-emerald-100">
            <span className="group-open:hidden">Показать</span>
            <span className="hidden group-open:inline">Свернуть</span>
          </span>
        </summary>

        <div className="mt-4 border-t border-white/10 pt-4">
          {item.sourceType === "imported" ? (
            <ImportedDescription text={text} />
          ) : (
            <p className="max-w-3xl whitespace-pre-line break-words text-zinc-300">{text}</p>
          )}
        </div>
      </details>
    </article>
  );
}
