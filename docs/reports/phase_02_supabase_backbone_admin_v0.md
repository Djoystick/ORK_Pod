# Phase 02: Supabase Backbone + Admin Manual Flow V0

Дата: 2026-04-11  
Проект: ORKPOD Archive (`h:\Work\ORKpod`)

## 1) Аудит состояния после Phase 01

На входе в этот проход в проекте уже были:
1. Публичные страницы:
   - `/`
   - `/streams`
   - `/streams/[slug]`
   - `/about`
2. Рабочие механики каталога:
   - поиск,
   - фильтры,
   - сортировка.
3. Визуальный shell (header/footer/layout) и seed-контент.

Код не пересоздавался с нуля: работа продолжена поверх текущего Phase 01.

## 2) Что добавлено в этом проходе

## 2.1 Расширена доменная модель (код/types)
Добавлены и/или расширены сущности:
1. `source_type` (`manual` / `imported`)
2. `import_status`
3. `content_status` (`draft` / `published` / `archived`)
4. `moderation_status`
5. `ContentSource`
6. `SourceChannel`
7. `CommentRecord` (comment-ready)
8. `ReactionRecord` (reaction-ready)
9. Поля lifecycle и source-метаданных в `ContentItem`:
   - `contentSourceId`
   - `externalSourceId`
   - `sourceType`
   - `importStatus`
   - `status`
   - `moderationStatus`
   - `createdAt` / `updatedAt`
   - `publishedAt`
   - `sourcePayload`

## 2.2 Supabase foundation
Сделан полноценный Supabase-ready foundation:
1. Инициализирован каталог `supabase/` через CLI.
2. Добавлена миграция:
   - `supabase/migrations/20260411094038_phase_02_backbone_admin_v0.sql`
3. Добавлен seed SQL:
   - `supabase/seed.sql`
4. Добавлен Supabase scaffolding в коде:
   - `src/lib/supabase/config.ts`
   - `src/lib/supabase/server.ts`
   - `src/lib/supabase/browser.ts`
5. Добавлены env/setup файлы:
   - `.env.example`
   - `docs/SUPABASE_SETUP.md`

## 2.3 Схема БД (таблицы и ограничения)
В миграции созданы таблицы:
1. `categories`
2. `series`
3. `tags`
4. `platforms`
5. `source_channels`
6. `content_sources`
7. `content_items`
8. `content_item_tags`
9. `external_links`
10. `comments` (comments-ready)
11. `reactions` (reactions-ready)

Дополнительно:
1. enum-типы для source/import/content/moderation/comment/reaction статусов.
2. dedupe-ограничения:
   - `content_sources(channel_id, external_source_id)` (partial unique)
   - `content_items(source_type, external_source_id)` (partial unique)
3. индексы на публичные и ingestion-критичные поля.
4. trigger `set_updated_at()` для системных таблиц.

## 2.4 Repository / Data Access layer
Введён явный repository/service boundary:
1. `src/types/repository.ts` — контракт репозитория.
2. `src/server/repositories/seed-content-repository.ts`
3. `src/server/repositories/supabase-content-repository.ts`
4. `src/server/repositories/content-repository.ts` — фабрика с fallback-обёрткой.
5. `src/server/services/public-content-service.ts`
6. `src/server/services/admin-content-service.ts`

Итог:
1. UI теперь ходит в service/repository слой, а не напрямую в seed-файлы.
2. При наличии Supabase-конфига можно читать/писать через Supabase-репозиторий.
3. При отсутствии/ошибке Supabase включается честный fallback к локальному seed/local store.

## 2.5 Admin manual content flow V0
Добавлен первый реальный admin flow:
1. `/admin` — обзорный экран.
2. `/admin/new` — форма ручного создания записи.
3. Server action:
   - `src/app/admin/new/actions.ts`
4. Поля формы соответствуют требованиям:
   - title
   - slug
   - excerpt
   - description
   - body (доп.)
   - category
   - series (optional)
   - platform
   - external URL
   - published date
   - source type = manual (скрытое поле + server-side гарантия)
   - content status

Временная безопасность (честно, не production auth):
1. bootstrap-режим с `ADMIN_BOOTSTRAP_KEY`, либо
2. ограниченный `localhost` dev-bootstrap режим.
3. В production без ключа запись блокируется.

## 2.6 Fallback mode
Реализован рабочий fallback:
1. Публичный сайт продолжает работать без Supabase env.
2. Источник данных в fallback:
   - seed из `src/data/*`,
   - локально созданные вручную записи: `data/manual-content-items.json`.
3. Admin create в fallback пишет в `data/manual-content-items.json`.
4. В публичном архиве показываются только записи со статусом `published`.

## 3) Влияние на публичный сайт

Публичный UX не сломан:
1. `Home` работает.
2. `Streams archive` работает.
3. `Stream detail` работает.
4. `About` работает.
5. Поиск/фильтры/сортировка сохранены.
6. Визуальный shell сохранён (добавлен пункт `Admin` в навигацию).

## 4) Команды, выполненные в этом проходе

1. Проверка Supabase CLI:
   - `supabase --version`
2. Инициализация Supabase:
   - `supabase init --yes`
3. Создание миграции:
   - `supabase migration new phase_02_backbone_admin_v0`
4. Установка зависимости:
   - `npm install @supabase/supabase-js`
5. Проверки качества:
   - `npm run lint`
   - `npm run build`
6. Smoke-проверка роутов через локальный запуск:
   - `/`, `/streams`, `/streams/live-build-nextjs-archive-grid`, `/about`, `/admin`, `/admin/new`
7. Попытка применить локальные миграции:
   - `supabase db reset` (неуспешно, см. ниже).

## 5) Что реально выполнено по миграциям

1. Миграционные SQL-файлы созданы и готовы.
2. `supabase db reset` **не выполнен успешно**:
   - причина: отсутствует/недоступен Docker Desktop в текущем окружении.
3. Следовательно, локальная БД в этом проходе **фактически не была поднята и не была мигрирована**.

## 6) Статус сборки и локального запуска

1. `npm run lint`: успешно.
2. `npm run build`: успешно.
3. Smoke-check HTTP (через `npm start`) по ключевым public/admin маршрутам: `200 OK`.

## 7) Файлы/папки, созданные или изменённые в Phase 02 (ключевые)

Создано:
1. `.env.example`
2. `data/manual-content-items.json`
3. `docs/SUPABASE_SETUP.md`
4. `docs/reports/phase_02_supabase_backbone_admin_v0.md`
5. `supabase/seed.sql`
6. `supabase/migrations/20260411094038_phase_02_backbone_admin_v0.sql`
7. `src/lib/supabase/*`
8. `src/server/repositories/*`
9. `src/server/services/*`
10. `src/server/storage/manual-item-store.ts`
11. `src/app/admin/*`
12. `src/types/repository.ts`
13. `src/data/source-channels.ts`

Изменено:
1. `src/types/content.ts`
2. `src/lib/content.ts`
3. `src/app/page.tsx`
4. `src/app/streams/page.tsx`
5. `src/app/streams/archive-explorer.tsx`
6. `src/app/streams/[slug]/page.tsx`
7. `src/components/archive/archive-card.tsx`
8. `src/components/layout/site-header.tsx`
9. `src/data/index.ts`
10. `package.json`
11. `package-lock.json`
12. `docs/ROADMAP.md`

## 8) Ограничения безопасности и auth на текущей фазе

1. Полноценной production-auth (roles, sessions, policies) нет.
2. RLS-политики не внедрены в рамках текущего прохода.
3. Admin write flow — только временный owner bootstrap механизм.
4. Это осознанное ограничение Phase 02 и отражено в коде/документации.

## 9) Что намеренно отложено

1. Полный ingestion pipeline YouTube (jobs/scheduler/retry-worker).
2. Полный UI для comments/reactions.
3. Полноценная moderation dashboard.
4. Production auth/RBAC/RLS hardening.
5. Deployment/CI/CD финализация.

## 10) Что делать в следующем проходе

1. Сделать admin editing/publish workflow v1:
   - редактирование существующих записей,
   - publish/unpublish,
   - статусные переходы.
2. Зафиксировать auth-модель для админки и начать внедрение RLS/policies.
3. Подготовить ingestion job-контракты для multi-channel YouTube импорта.
