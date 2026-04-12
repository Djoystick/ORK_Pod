# Phase 04 — YouTube Ingestion V1 (admin-triggered)

## 1. Стартовая точка (что было до изменений)
На момент старта прохода в проекте уже присутствовали результаты Phase 01–03:
1. Публичные маршруты: `/`, `/streams`, `/streams/[slug]`, `/about`.
2. Рабочие поиск/фильтры/сортировка и каталог.
3. Admin CMS: создание/редактирование/публикация контента.
4. Source registry (`/admin/sources`) и централизованный временный admin gate.
5. Репозиторный слой с fallback-режимом.
6. В source registry уже присутствовали обязательные каналы:
   - `orkcut` -> `https://www.youtube.com/@orkcut/videos`
   - `orkstream` -> `https://www.youtube.com/@orkstream/videos`

## 2. Что реализовано в Phase 04

### 2.1. Расширение домена ingestion
Добавлены ingestion-сущности и статусы:
1. `ImportRunStatus`: `queued | running | success | partial_success | failed`.
2. `ImportItemResultStatus`: `created | updated | skipped_duplicate | failed`.
3. `ImportRun` и `ImportRunItemResult`.
4. Sync-поля у `SourceChannel`:
   - `lastSyncedAt`
   - `lastSuccessfulSyncAt`
   - `lastErrorAt`
   - `lastErrorMessage`

Файл:
1. `src/types/content.ts`

### 2.2. Репозиторный контракт и реализации
В `ContentRepository` добавлены методы:
1. `runSourceSync(sourceId)`
2. `runAllActiveSourceSync()`
3. `listImportRuns(limit?)`

Реализации:
1. `SeedContentRepository`:
   - полноценный ingestion path для fallback-режима;
   - запись import runs и sync-метрик;
   - дедуп и safe update правилa.
2. `SupabaseContentRepository`:
   - сохранена базовая read/write CMS-совместимость;
   - ingestion-методы в текущем runtime явно бросают ошибку, чтобы `FallbackContentRepository` честно переключался на fallback-реализацию.
3. `FallbackContentRepository`:
   - поддержка новых ingestion-методов с автоматическим fallback.

Файлы:
1. `src/types/repository.ts`
2. `src/server/repositories/content-repository.ts`
3. `src/server/repositories/seed-content-repository.ts`
4. `src/server/repositories/supabase-content-repository.ts`

### 2.3. Ядро ingestion v1 (YouTube)
Реализован сервис:
1. резолв source channel:
   - напрямую из `externalChannelId` вида `UC...`,
   - из `sourceUrl` (`/channel/UC...`),
   - через `@handle` lookup (запрос страницы канала и извлечение `channelId` из HTML);
2. загрузка Atom/RSS feed:
   - `https://www.youtube.com/feeds/videos.xml?channel_id=...`
3. парсинг `<entry>` и нормализация видео в внутреннюю структуру;
4. генерация slug, excerpt/description/body fallback;
5. перенос thumbnail в cover.

Выбранный механизм: **YouTube RSS feed + handle/channel resolve** (без YouTube Data API).  
Это прямо и честно отражено в коде.

Файл:
1. `src/server/services/youtube-ingestion-service.ts`

### 2.4. Дедупликация и safe update правила
Правила в текущем ingestion v1:
1. Дедуп по `externalSourceId` (YouTube video id) для `sourceType=imported`.
2. При повторном sync:
   - если данных нет изменений -> `skipped_duplicate`;
   - при изменениях -> `updated`.
3. Ручные правки description/body/excerpt защищаются snapshot-логикой:
   - если поле было вручную изменено относительно импортного snapshot, ingestion его не перезаписывает.
4. Для новых импортов статус по умолчанию: `draft` (чтобы не утекало в публичный каталог без модерации/публикации).

### 2.5. Fallback storage для ingestion
Добавлено локальное хранилище import history:
1. `data/local-import-runs.json`
2. сохранены существующие fallback-файлы:
   - `data/local-content-items.json`
   - `data/local-source-channels.json`

Файлы:
1. `src/server/storage/local-fallback-store.ts`
2. `.gitignore` (ignore для локальных fallback JSON)

### 2.6. Admin UI ingestion v1
Обновлены/добавлены админские маршруты:
1. `/admin/sources`
   - sync одной source channel,
   - sync всех активных источников,
   - отображение sync-метрик по source,
   - блок последних import runs.
2. `/admin/imports`
   - таблица истории import runs (status, timestamps, counts, error).
3. `/admin`
   - расширены overview-метрики по импортам.

Файлы:
1. `src/app/admin/sources/actions.ts`
2. `src/app/admin/sources/source-registry-form.tsx`
3. `src/app/admin/sources/page.tsx`
4. `src/app/admin/imports/page.tsx`
5. `src/app/admin/layout.tsx`
6. `src/app/admin/page.tsx`
7. `src/server/services/admin-source-service.ts`
8. `src/server/services/admin-content-service.ts`

### 2.7. Supabase schema foundation для ingestion
Добавлена migration:
1. enum-статусы import run/item;
2. sync-поля в `source_channels`;
3. таблицы:
   - `import_runs`
   - `import_run_items`
4. индексы для аудита/поиска.

Файл:
1. `supabase/migrations/20260411183000_phase_04_youtube_ingestion_v1.sql`

## 3. Команды, которые выполнялись
1. `npm run lint`
2. `npm run build`
3. `supabase --version`
4. `supabase db reset`
5. smoke-проверки HTTP маршрутов через `npm start -- --port ...` + `Invoke-WebRequest`
6. ingestion smoke через `npx tsx` с `NODE_OPTIONS=--conditions=react-server`

## 4. Результаты проверок

### 4.1. Lint/Build
1. `npm run lint` — успешно.
2. `npm run build` — успешно.

### 4.2. Проверка маршрутов
Проверены маршруты, код ответа `200`:
1. `/`
2. `/streams`
3. `/streams/live-build-nextjs-archive-grid`
4. `/about`
5. `/admin`
6. `/admin/content`
7. `/admin/sources`
8. `/admin/imports`

### 4.3. Проверка ingestion/dedup (реальный smoke)
Результат smoke-запуска ingestion для `orkcut`:
1. 1-й sync: `success`, `created=15`, `updated=0`, `skipped=0`, `failed=0`.
2. 2-й sync: `success`, `created=0`, `updated=0`, `skipped=15`, `failed=0`.
3. Проверка дублей: `duplicateExternalIdCount=0`.

### 4.4. Проверка публичной изоляции draft импортов
Проверка одного импортированного `draft` slug на публичной detail-странице:
1. `/streams/<draft-imported-slug>` -> `404` (draft не утек в публичный архив).

Дополнительно repository-level проверка:
1. временно перевели imported item в `published`,
2. `getItemBySlug(importedSlug)` вернул запись (`foundInPublicLookupWhenPublished=true`),
3. статус возвращен обратно в исходный (`draft`).

## 5. Supabase runtime статус (честный)
`supabase db reset` не выполнен из-за окружения:
1. Docker Desktop недоступен (`docker_engine` pipe not found).
2. Поэтому миграции в этой среде **не были реально применены**.
3. DB runtime в этом проходе не фейкался; ingestion тестировался через fallback path.

## 6. Как сейчас работает fallback mode
1. Если Supabase не доступен/не сконфигурирован:
   - публичная часть работает на fallback данных;
   - admin CMS работает;
   - ingestion v1 работает через локальный storage.
2. История импортов и импортированные записи сохраняются локально:
   - `data/local-import-runs.json`
   - `data/local-content-items.json`
   - `data/local-source-channels.json`

## 7. Ограничения и долги после Phase 04
1. Supabase ingestion write path в текущем runtime не активирован до полного DB runtime + migration apply в локальном окружении.
2. Нет scheduler/cron ingestion (только admin-triggered).
3. Нет retry/backoff/orchestration слоя для массовых импортов.
4. Нет production auth/RLS hardening (остается временный bootstrap gate).

## 8. Что рекомендуется в следующем проходе (Phase 05)
1. Перевести ingestion на automation v2:
   - scheduler/cron,
   - retry policy,
   - locking/идемпотентность job execution.
2. Довести Supabase ingestion runtime parity с fallback (после реального применения миграций).
3. Расширить `/admin/imports`:
   - фильтры,
   - просмотр item-level ошибок,
   - re-run операций.
