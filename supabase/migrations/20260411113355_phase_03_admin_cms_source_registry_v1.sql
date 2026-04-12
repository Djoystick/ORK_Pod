alter table if exists source_channels
  add column if not exists is_active boolean not null default true;

alter table if exists source_channels
  add column if not exists notes text;

create index if not exists source_channels_active_idx
  on source_channels(is_active);
