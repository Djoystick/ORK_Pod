create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'source_type_enum') then
    create type source_type_enum as enum ('manual', 'imported');
  end if;
  if not exists (select 1 from pg_type where typname = 'import_status_enum') then
    create type import_status_enum as enum ('not_applicable', 'pending', 'imported', 'failed', 'skipped');
  end if;
  if not exists (select 1 from pg_type where typname = 'content_status_enum') then
    create type content_status_enum as enum ('draft', 'published', 'archived');
  end if;
  if not exists (select 1 from pg_type where typname = 'moderation_status_enum') then
    create type moderation_status_enum as enum ('clean', 'pending_review', 'flagged', 'blocked');
  end if;
  if not exists (select 1 from pg_type where typname = 'comment_status_enum') then
    create type comment_status_enum as enum ('pending', 'approved', 'rejected', 'hidden');
  end if;
  if not exists (select 1 from pg_type where typname = 'reaction_type_enum') then
    create type reaction_type_enum as enum ('like', 'love', 'insight', 'fire');
  end if;
end
$$;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists series (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete restrict,
  slug text not null unique,
  title text not null,
  description text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists platforms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  kind text not null check (kind in ('video', 'stream', 'social')),
  base_url text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists source_channels (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  platform_id uuid not null references platforms(id) on delete restrict,
  external_channel_id text,
  source_url text,
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists source_channels_platform_external_uidx
  on source_channels(platform_id, external_channel_id)
  where external_channel_id is not null;

create table if not exists content_sources (
  id uuid primary key default gen_random_uuid(),
  source_type source_type_enum not null,
  channel_id uuid references source_channels(id) on delete set null,
  external_source_id text,
  import_status import_status_enum not null default 'pending',
  source_payload jsonb,
  imported_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists content_sources_dedupe_uidx
  on content_sources(channel_id, external_source_id)
  where external_source_id is not null;

create index if not exists content_sources_type_status_idx
  on content_sources(source_type, import_status);

create table if not exists content_items (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text not null,
  description text not null,
  body text,
  category_id uuid not null references categories(id) on delete restrict,
  series_id uuid references series(id) on delete set null,
  platform_id uuid not null references platforms(id) on delete restrict,
  source_type source_type_enum not null default 'manual',
  content_source_id uuid references content_sources(id) on delete set null,
  external_source_id text,
  import_status import_status_enum not null default 'not_applicable',
  status content_status_enum not null default 'draft',
  moderation_status moderation_status_enum not null default 'clean',
  published_at timestamptz,
  duration_minutes integer not null default 0 check (duration_minutes >= 0),
  cover jsonb not null default '{"kind":"gradient","alt":"","palette":["#1D4ED8","#0F172A"]}'::jsonb,
  source_payload jsonb,
  featured boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz
);

create unique index if not exists content_items_source_dedupe_uidx
  on content_items(source_type, external_source_id)
  where external_source_id is not null;

create index if not exists content_items_status_published_idx
  on content_items(status, published_at desc);
create index if not exists content_items_category_idx
  on content_items(category_id);
create index if not exists content_items_series_idx
  on content_items(series_id);
create index if not exists content_items_platform_idx
  on content_items(platform_id);
create index if not exists content_items_content_source_idx
  on content_items(content_source_id);

create table if not exists content_item_tags (
  content_item_id uuid not null references content_items(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (content_item_id, tag_id)
);

create index if not exists content_item_tags_tag_idx
  on content_item_tags(tag_id);

create table if not exists external_links (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references content_items(id) on delete cascade,
  link_kind text not null,
  label text not null,
  url text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists external_links_item_url_uidx
  on external_links(content_item_id, url);

create index if not exists external_links_item_idx
  on external_links(content_item_id);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references content_items(id) on delete cascade,
  parent_id uuid references comments(id) on delete cascade,
  author_display text not null,
  author_email_hash text,
  body text not null,
  status comment_status_enum not null default 'pending',
  moderation_status moderation_status_enum not null default 'pending_review',
  moderation_reason text,
  source_ip_hash text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists comments_item_status_created_idx
  on comments(content_item_id, status, created_at desc);

create index if not exists comments_parent_idx
  on comments(parent_id);

create table if not exists reactions (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references content_items(id) on delete cascade,
  reaction_type reaction_type_enum not null,
  actor_fingerprint text,
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists reactions_actor_unique_uidx
  on reactions(content_item_id, reaction_type, actor_fingerprint)
  where actor_fingerprint is not null;

create index if not exists reactions_item_type_idx
  on reactions(content_item_id, reaction_type);

drop trigger if exists categories_set_updated_at on categories;
create trigger categories_set_updated_at
before update on categories
for each row execute procedure set_updated_at();

drop trigger if exists series_set_updated_at on series;
create trigger series_set_updated_at
before update on series
for each row execute procedure set_updated_at();

drop trigger if exists tags_set_updated_at on tags;
create trigger tags_set_updated_at
before update on tags
for each row execute procedure set_updated_at();

drop trigger if exists platforms_set_updated_at on platforms;
create trigger platforms_set_updated_at
before update on platforms
for each row execute procedure set_updated_at();

drop trigger if exists source_channels_set_updated_at on source_channels;
create trigger source_channels_set_updated_at
before update on source_channels
for each row execute procedure set_updated_at();

drop trigger if exists content_sources_set_updated_at on content_sources;
create trigger content_sources_set_updated_at
before update on content_sources
for each row execute procedure set_updated_at();

drop trigger if exists content_items_set_updated_at on content_items;
create trigger content_items_set_updated_at
before update on content_items
for each row execute procedure set_updated_at();

drop trigger if exists comments_set_updated_at on comments;
create trigger comments_set_updated_at
before update on comments
for each row execute procedure set_updated_at();
