"use client";

import type { ArchiveFilters, SelectOption } from "@/types/content";

type ArchiveControlsProps = {
  filters: ArchiveFilters;
  categoryOptions: SelectOption[];
  seriesOptions: SelectOption[];
  platformOptions: SelectOption[];
  onChange: (next: Partial<ArchiveFilters>) => void;
  onReset: () => void;
};

type SelectFieldProps = {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
};

function SelectField({ label, value, options, onChange }: SelectFieldProps) {
  return (
    <label className="grid gap-2 text-xs uppercase tracking-[0.14em] text-zinc-400">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-xl border border-white/15 bg-black/35 px-3 text-sm normal-case tracking-normal text-zinc-100 outline-none transition focus:border-emerald-300/80"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ArchiveControls({
  filters,
  categoryOptions,
  seriesOptions,
  platformOptions,
  onChange,
  onReset,
}: ArchiveControlsProps) {
  return (
    <div className="space-y-5 rounded-3xl border border-white/10 bg-[#0b1612]/90 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-emerald-300">Поиск и фильтры</p>
          <p className="mt-1 text-sm text-zinc-300">Соберите собственную витрину контента.</p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-zinc-200 transition hover:border-emerald-300/45 hover:text-emerald-100"
        >
          Сбросить
        </button>
      </div>

      <label className="grid gap-2 text-xs uppercase tracking-[0.14em] text-zinc-400">
        Поиск
        <input
          type="search"
          value={filters.search}
          onChange={(event) => onChange({ search: event.target.value })}
          placeholder="Название, тег, серия, платформа"
          className="h-12 rounded-xl border border-white/15 bg-black/35 px-4 text-sm normal-case tracking-normal text-zinc-100 outline-none transition focus:border-emerald-300/80"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          label="Категория"
          value={filters.category}
          options={categoryOptions}
          onChange={(value) => onChange({ category: value })}
        />
        <SelectField
          label="Серия"
          value={filters.series}
          options={seriesOptions}
          onChange={(value) => onChange({ series: value })}
        />
        <SelectField
          label="Платформа"
          value={filters.platform}
          options={platformOptions}
          onChange={(value) => onChange({ platform: value })}
        />
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Сортировка</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onChange({ sort: "newest" })}
            className={`h-10 rounded-xl border px-3 text-sm transition ${
              filters.sort === "newest"
                ? "border-emerald-300/45 bg-emerald-300/20 text-emerald-100"
                : "border-white/15 bg-white/[0.03] text-zinc-200 hover:border-emerald-300/45"
            }`}
          >
            Сначала новые
          </button>
          <button
            type="button"
            onClick={() => onChange({ sort: "oldest" })}
            className={`h-10 rounded-xl border px-3 text-sm transition ${
              filters.sort === "oldest"
                ? "border-emerald-300/45 bg-emerald-300/20 text-emerald-100"
                : "border-white/15 bg-white/[0.03] text-zinc-200 hover:border-emerald-300/45"
            }`}
          >
            Сначала старые
          </button>
        </div>
      </div>
    </div>
  );
}
