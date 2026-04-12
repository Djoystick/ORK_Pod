insert into categories (slug, title, description)
values
  ('interview', 'Интервью', 'Беседы с авторами и гостями про процессы и закулисье продакшена.'),
  ('analysis', 'Аналитика', 'Разборы эфиров и выпусков: структура, техника, динамика и выводы.'),
  ('practice', 'Практика', 'Лайв-сессии с прикладными задачами и реальными результатами.'),
  ('community', 'Сообщество', 'Открытые Q&A и обсуждения с аудиторией.')
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
  ('nextjs', 'Next.js'),
  ('streaming', 'Стриминг'),
  ('editorial', 'Редактура'),
  ('community', 'Комьюнити'),
  ('ux', 'UX'),
  ('analytics', 'Аналитика'),
  ('obs', 'OBS'),
  ('audio', 'Аудио'),
  ('automation', 'Автоматизация'),
  ('typescript', 'TypeScript'),
  ('archive', 'Архив'),
  ('process', 'Процессы')
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
    'Inside Stream',
    'Интервью о производстве контента, ролях в команде и технической кухне.'
  ),
  (
    'retro-air',
    (select id from category_map where slug = 'analysis'),
    'Retro Air',
    'Пост-эфирные разборы с фокусом на структуру, ритм и удержание внимания.'
  ),
  (
    'live-build',
    (select id from category_map where slug = 'practice'),
    'Live Build',
    'Практические стримы с реальной задачей и ограниченным временем.'
  ),
  (
    'qna-room',
    (select id from category_map where slug = 'community'),
    'Q&A Room',
    'Открытый формат вопросов и ответов с короткими прикладными демо.'
  ),
  (
    'archive-notes',
    (select id from category_map where slug = 'analysis'),
    'Archive Notes',
    'Короткие выпуски с заметками по старым записям и повторными выводами.'
  ),
  (
    'tooling-lab',
    (select id from category_map where slug = 'practice'),
    'Tooling Lab',
    'Серии по инструментам и рабочим пайплайнам для стрим-команды.'
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
    'UC-ORKPOD-YouTube',
    'https://youtube.com/@orkpod',
    true,
    'Наследуемый канал из раннего seed-набора.'
  )
on conflict (slug)
do update set
  title = excluded.title,
  platform_id = excluded.platform_id,
  external_channel_id = excluded.external_channel_id,
  source_url = excluded.source_url,
  is_active = excluded.is_active,
  notes = excluded.notes;
