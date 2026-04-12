"use client";

import type { ArchiveFilters, SelectOption } from "@/types/content";

type ArchiveControlsProps = {
  filters: ArchiveFilters;
  categoryOptions: SelectOption[];
  seriesOptions: SelectOption[];
  platformOptions: SelectOption[];
  onChange: (next: Partial<ArchiveFilters>) => void;
};

type SelectFieldProps = {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
};

function SelectField({ label, value, options, onChange }: SelectFieldProps) {
  return (
    <label className="grid gap-2 text-sm text-zinc-300">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-xl border border-white/15 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-emerald-300/80"
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
}: ArchiveControlsProps) {
  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      <label className="grid gap-2 text-sm text-zinc-300">
        Поиск по архиву
        <input
          type="search"
          value={filters.search}
          onChange={(event) => onChange({ search: event.target.value })}
          placeholder="Название, тег, серия, платформа"
          className="h-12 rounded-xl border border-white/15 bg-black/30 px-4 text-sm text-zinc-100 outline-none transition focus:border-emerald-300/80"
        />
      </label>

      <div className="grid gap-3 md:grid-cols-4">
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
        <SelectField
          label="Сортировка"
          value={filters.sort}
          options={[
            { value: "newest", label: "Сначала новые" },
            { value: "oldest", label: "Сначала старые" },
          ]}
          onChange={(value) => onChange({ sort: value as ArchiveFilters["sort"] })}
        />
      </div>
    </div>
  );
}
