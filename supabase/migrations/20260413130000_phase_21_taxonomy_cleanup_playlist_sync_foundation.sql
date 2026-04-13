alter table if exists source_channels
  add column if not exists last_playlist_synced_at timestamptz;

alter table if exists source_channels
  add column if not exists last_playlist_count integer;

alter table if exists source_channels
  add column if not exists last_playlist_item_count integer;

alter table if exists source_channels
  add column if not exists playlist_sync_mode text
  check (playlist_sync_mode in ('api_primary', 'disabled_no_api_key', 'error'));

alter table if exists source_channels
  add column if not exists playlist_sync_message text;

create table if not exists playlists (
  id uuid primary key default gen_random_uuid(),
  source_channel_id uuid not null references source_channels(id) on delete cascade,
  external_playlist_id text not null unique,
  slug text not null unique,
  title text not null,
  description text,
  external_url text not null,
  thumbnail_url text,
  item_count integer not null default 0 check (item_count >= 0),
  synced_item_count integer not null default 0 check (synced_item_count >= 0),
  linked_item_count integer not null default 0 check (linked_item_count >= 0),
  is_active boolean not null default true,
  published_at timestamptz,
  source_payload jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists playlists_source_channel_idx
  on playlists(source_channel_id);

create index if not exists playlists_last_synced_idx
  on playlists(last_synced_at desc);

create table if not exists playlist_items (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references playlists(id) on delete cascade,
  content_item_id uuid references content_items(id) on delete set null,
  external_video_id text not null,
  position integer not null default 0 check (position >= 0),
  title text,
  added_at timestamptz,
  source_payload jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists playlist_items_playlist_external_video_uidx
  on playlist_items(playlist_id, external_video_id);

create index if not exists playlist_items_playlist_idx
  on playlist_items(playlist_id);

create index if not exists playlist_items_content_item_idx
  on playlist_items(content_item_id);

drop trigger if exists playlists_set_updated_at on playlists;
create trigger playlists_set_updated_at
before update on playlists
for each row execute procedure set_updated_at();

drop trigger if exists playlist_items_set_updated_at on playlist_items;
create trigger playlist_items_set_updated_at
before update on playlist_items
for each row execute procedure set_updated_at();

alter table if exists playlists enable row level security;
alter table if exists playlist_items enable row level security;

drop policy if exists playlists_public_read on playlists;
create policy playlists_public_read
  on playlists for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists playlist_items_public_read on playlist_items;
create policy playlist_items_public_read
  on playlist_items for select
  to anon, authenticated
  using (
    exists (
      select 1
      from playlists p
      where p.id = playlist_items.playlist_id
        and p.is_active = true
    )
  );

drop policy if exists playlists_admin_manage on playlists;
create policy playlists_admin_manage
  on playlists for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

drop policy if exists playlist_items_admin_manage on playlist_items;
create policy playlist_items_admin_manage
  on playlist_items for all
  to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

update categories
set
  title = case slug
    when 'interview' then 'Разговорные выпуски'
    when 'analysis' then 'Новости и разборы'
    when 'practice' then 'Нарезки и хайлайты'
    when 'community' then 'Стримы и кооп'
    else title
  end,
  description = case slug
    when 'interview' then 'Длинные форматы с обсуждениями, гостями и контекстом вокруг стрим-контента.'
    when 'analysis' then 'Новости индустрии, аналитические сюжеты и редакторские разборы по игровым темам.'
    when 'practice' then 'Короткие динамичные нарезки с яркими моментами, челленджами и игровыми эпизодами.'
    when 'community' then 'Полные эфиры, дуэты и кооперативные прохождения с участием сообщества.'
    else description
  end,
  updated_at = timezone('utc', now())
where slug in ('interview', 'analysis', 'practice', 'community');

update series
set
  title = case slug
    when 'inside-stream' then 'Глубокие беседы'
    when 'retro-air' then 'Индустрия и Blizzard'
    when 'live-build' then 'Нарезки orkcut'
    when 'qna-room' then 'Стримы orkstream'
    when 'archive-notes' then 'Новости ORKPOD'
    when 'tooling-lab' then 'Симуляторы и выживание'
    else title
  end,
  description = case slug
    when 'inside-stream' then 'Разговорные выпуски с гостями и расширенным контекстом вокруг эфиров.'
    when 'retro-air' then 'Новостные и аналитические выпуски о Blizzard, WoW, Diablo и смежных темах.'
    when 'live-build' then 'Короткие хайлайты и динамичные игровые эпизоды с канала orkcut.'
    when 'qna-room' then 'Полные эфиры, кооп-прохождения и сессии с живым взаимодействием команды.'
    when 'archive-notes' then 'Отдельная линия новостных сюжетов и реактов ORKPOD YouTube.'
    when 'tooling-lab' then 'Игровые подборки с упором на симуляторы, хоррор и выживание в формате нарезок.'
    else description
  end,
  updated_at = timezone('utc', now())
where slug in ('inside-stream', 'retro-air', 'live-build', 'qna-room', 'archive-notes', 'tooling-lab');

update tags
set
  label = case slug
    when 'nextjs' then 'TES / Skyrim'
    when 'streaming' then 'Стримы'
    when 'editorial' then 'Нарезки'
    when 'community' then 'Кооп'
    when 'ux' then 'Хорроры'
    when 'analytics' then 'Новости индустрии'
    when 'obs' then 'Blizzard'
    when 'audio' then 'RPG'
    when 'automation' then 'Симуляторы'
    when 'typescript' then 'Экшен'
    when 'archive' then 'WoW / Diablo'
    when 'process' then 'Реакты и обсуждения'
    else label
  end,
  updated_at = timezone('utc', now())
where slug in (
  'nextjs',
  'streaming',
  'editorial',
  'community',
  'ux',
  'analytics',
  'obs',
  'audio',
  'automation',
  'typescript',
  'archive',
  'process'
);

update source_channels
set
  external_channel_id = case
    when slug = 'orkpod-youtube' then 'UCPZZring891k7JVnr70dlIw'
    else external_channel_id
  end,
  notes = case
    when slug = 'orkpod-youtube' then 'Канал новостных и аналитических выпусков ORKPOD.'
    else notes
  end,
  updated_at = timezone('utc', now())
where slug = 'orkpod-youtube';

update content_items
set
  status = 'archived',
  archived_at = coalesce(archived_at, timezone('utc', now())),
  updated_at = timezone('utc', now())
where source_type = 'manual'
  and (
    slug like 'inside-stream-%' or
    slug like 'retro-air-%' or
    slug like 'live-build-%' or
    slug like 'qna-room-%' or
    slug like 'archive-notes-%' or
    slug like 'tooling-lab-%'
  );
