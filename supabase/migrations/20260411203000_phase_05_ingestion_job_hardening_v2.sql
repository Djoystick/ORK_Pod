alter table if exists source_channels
  add column if not exists sync_in_progress boolean not null default false;

alter table if exists source_channels
  add column if not exists sync_lock_token text;

alter table if exists source_channels
  add column if not exists sync_lock_expires_at timestamptz;

create index if not exists source_channels_sync_in_progress_idx
  on source_channels(sync_in_progress);

create index if not exists source_channels_sync_lock_expires_idx
  on source_channels(sync_lock_expires_at);

alter table if exists import_runs
  add column if not exists trigger text not null default 'sync_source';

alter table if exists import_runs
  add column if not exists parent_run_id uuid references import_runs(id) on delete set null;

alter table if exists import_runs
  add column if not exists request_key text;

alter table if exists import_runs
  add column if not exists lock_acquired_at timestamptz;

alter table if exists import_runs
  add column if not exists lock_released_at timestamptz;

alter table if exists import_runs
  add constraint import_runs_trigger_check
  check (trigger in ('sync_source', 'sync_all', 'rerun_source', 'retry_failed_items'));

create unique index if not exists import_runs_request_key_uidx
  on import_runs(request_key)
  where request_key is not null;

create index if not exists import_runs_source_status_started_idx
  on import_runs(source_channel_id, status, started_at desc);

create index if not exists import_runs_parent_run_idx
  on import_runs(parent_run_id);
