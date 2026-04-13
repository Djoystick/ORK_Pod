insert into categories (slug, title, description)
values
  ('interview', 'Разговорные выпуски', 'Длинные форматы с обсуждениями, гостями и контекстом вокруг стрим-контента.'),
  ('analysis', 'Новости и разборы', 'Новости индустрии, аналитические сюжеты и редакторские разборы по игровым темам.'),
  ('practice', 'Нарезки и хайлайты', 'Короткие динамичные нарезки с яркими моментами, челленджами и игровыми эпизодами.'),
  ('community', 'Стримы и кооп', 'Полные эфиры, дуэты и кооперативные прохождения с участием сообщества.')
on conflict (slug)
do update set
  title = excluded.title,
  description = excluded.description;

insert into platforms (slug, title, kind, base_url)
values
  ('youtube', 'YouTube', 'video', 'https://youtube.com'),
  ('twitch', 'Twitch', 'stream', 'https://twitch.tv'),
  ('vk-video', 'VK Видео', 'video', 'https://vkvideo.ru'),
  ('telegram', 'Telegram', 'social', 'https://t.me')
on conflict (slug)
do update set
  title = excluded.title,
  kind = excluded.kind,
  base_url = excluded.base_url;

insert into tags (slug, label)
values
  ('nextjs', 'TES / Skyrim'),
  ('streaming', 'Стримы'),
  ('editorial', 'Нарезки'),
  ('community', 'Кооп'),
  ('ux', 'Хорроры'),
  ('analytics', 'Новости индустрии'),
  ('obs', 'Blizzard'),
  ('audio', 'RPG'),
  ('automation', 'Симуляторы'),
  ('typescript', 'Экшен'),
  ('archive', 'WoW / Diablo'),
  ('process', 'Реакты и обсуждения')
on conflict (slug)
do update set
  label = excluded.label;

with category_map as (
  select id, slug
  from categories
)
insert into series (slug, category_id, title, description)
values
  (
    'inside-stream',
    (select id from category_map where slug = 'interview'),
    'Глубокие беседы',
    'Разговорные выпуски с гостями и расширенным контекстом вокруг эфиров.'
  ),
  (
    'retro-air',
    (select id from category_map where slug = 'analysis'),
    'Индустрия и Blizzard',
    'Новостные и аналитические выпуски о Blizzard, WoW, Diablo и смежных темах.'
  ),
  (
    'live-build',
    (select id from category_map where slug = 'practice'),
    'Нарезки orkcut',
    'Короткие хайлайты и динамичные игровые эпизоды с канала orkcut.'
  ),
  (
    'qna-room',
    (select id from category_map where slug = 'community'),
    'Стримы orkstream',
    'Полные эфиры, кооп-прохождения и сессии с живым взаимодействием команды.'
  ),
  (
    'archive-notes',
    (select id from category_map where slug = 'analysis'),
    'Новости ORKPOD',
    'Отдельная линия новостных сюжетов и реактов ORKPOD YouTube.'
  ),
  (
    'tooling-lab',
    (select id from category_map where slug = 'practice'),
    'Симуляторы и выживание',
    'Игровые подборки с упором на симуляторы, хоррор и выживание в формате нарезок.'
  )
on conflict (slug)
do update set
  category_id = excluded.category_id,
  title = excluded.title,
  description = excluded.description;

with platform_map as (
  select id, slug
  from platforms
)
insert into source_channels (
  slug,
  title,
  platform_id,
  external_channel_id,
  source_url,
  is_active,
  notes
)
values
  (
    'orkcut',
    'orkcut',
    (select id from platform_map where slug = 'youtube'),
    '@orkcut',
    'https://www.youtube.com/@orkcut/videos',
    true,
    'Первый обязательный канал для ingestion.'
  ),
  (
    'orkstream',
    'orkstream',
    (select id from platform_map where slug = 'youtube'),
    '@orkstream',
    'https://www.youtube.com/@orkstream/videos',
    true,
    'Второй обязательный канал для ingestion.'
  ),
  (
    'orkpod-youtube',
    'ORKPOD YouTube',
    (select id from platform_map where slug = 'youtube'),
    'UCPZZring891k7JVnr70dlIw',
    'https://youtube.com/@orkpod',
    true,
    'Канал новостных и аналитических выпусков ORKPOD.'
  )
on conflict (slug)
do update set
  title = excluded.title,
  platform_id = excluded.platform_id,
  external_channel_id = excluded.external_channel_id,
  source_url = excluded.source_url,
  is_active = excluded.is_active,
  notes = excluded.notes;
