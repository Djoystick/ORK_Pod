do $$
begin
  if not exists (select 1 from pg_type where typname = 'import_run_status_enum') then
    create type import_run_status_enum as enum ('queued', 'running', 'success', 'partial_success', 'failed');
  end if;

  if not exists (select 1 from pg_type where typname = 'import_item_result_status_enum') then
    create type import_item_result_status_enum as enum ('created', 'updated', 'skipped_duplicate', 'failed');
  end if;
end
$$;

alter table if exists source_channels
  add column if not exists last_synced_at timestamptz;

alter table if exists source_channels
  add column if not exists last_successful_sync_at timestamptz;

alter table if exists source_channels
  add column if not exists last_error_at timestamptz;

alter table if exists source_channels
  add column if not exists last_error_message text;

create index if not exists source_channels_last_successful_sync_idx
  on source_channels(last_successful_sync_at desc);

create table if not exists import_runs (
  id uuid primary key default gen_random_uuid(),
  source_channel_id uuid not null references source_channels(id) on delete restrict,
  status import_run_status_enum not null default 'queued',
  started_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz,
  created_count integer not null default 0 check (created_count >= 0),
  updated_count integer not null default 0 check (updated_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  error_message text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists import_runs_source_started_idx
  on import_runs(source_channel_id, started_at desc);

create index if not exists import_runs_status_started_idx
  on import_runs(status, started_at desc);

create table if not exists import_run_items (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid not null references import_runs(id) on delete cascade,
  external_source_id text not null,
  content_item_id uuid references content_items(id) on delete set null,
  status import_item_result_status_enum not null,
  message text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists import_run_items_run_idx
  on import_run_items(import_run_id);

create index if not exists import_run_items_status_idx
  on import_run_items(status);

create unique index if not exists import_run_items_unique_per_run_uidx
  on import_run_items(import_run_id, external_source_id);
