# Phase 14B — live ingestion runtime parity и API-primary activation

Дата: 2026-04-12  
Проект: ORKPOD Archive

## 1) Стартовое состояние (до правок)
1. После Phase 14A страница `/admin/sources` перестала падать по `EROFS`, но в UI оставался warning:
   - `Supabase ingestion path is not active in this phase runtime. Fallback repository will be used.`
2. Root cause был не в UI:
   - в `src/server/repositories/supabase-content-repository.ts` методы ingestion (`runSourceSync`, `runAllActiveSourceSync`, `getImportRunById`, `listImportRuns`) были заглушками и всегда бросали ошибку runtime-unavailable;
   - из-за этого production-путь не мог работать как primary Supabase/API-backed ingestion runtime.

## 2) Что именно изменено

### A. Включён рабочий Supabase ingestion runtime
В `src/server/repositories/supabase-content-repository.ts` реализованы вместо заглушек:
1. `runSourceSync(...)`
2. `runAllActiveSourceSync(...)`
3. `getImportRunById(...)`
4. `listImportRuns(...)`

### B. Реальный source sync path в Supabase
В `runSourceSync(...)` добавлено:
1. Запуск ingestion через уже существующий API-backed pipeline `fetchYouTubeChannelVideos(...)`.
2. Создание/обновление imported content в Supabase таблицах:
   - `content_sources`
   - `content_items`
   - `external_links`
   - `content_item_tags`
3. Сохранение import run telemetry:
   - `import_runs`
   - `import_run_items`
4. Обновление operational состояния источника в `source_channels`:
   - `last_synced_at`
   - `last_successful_sync_at`
   - `last_error_at`
   - `last_error_message`
   - canonical `external_channel_id` (когда доступен и валиден).

### C. Runtime parity для admin surface
1. `/admin/sources` и `/admin/imports` больше не обязаны попадать в fallback-runtime warning из-за заглушек Supabase репозитория.
2. Warning-path теперь не “скрыт”, а устранён в коде: ingestion methods реально доступны в Supabase репозитории.

## 3) Сохранение safety-гарантий
Сохранены и перенесены в Supabase ingestion path:
1. Dedupe по внешнему ID (`external_source_id`) и безопасная обработка duplicate race (`23505`).
2. Anti-concurrency / sync-all guards:
   - остаются в `ingestion-job-service` + lock layer (из Phase 14A).
3. Rerun / retry_failed_items:
   - retry фильтрует по failed external IDs.
4. Safe automation defaults:
   - review/draft logic сохраняется;
   - auto-publish только по существующим строгим условиям.
5. Manual edit protection:
   - ingestion snapshot + override-aware update logic сохраняет ручные правки, если поля уже “оторваны” от ingestion snapshot.

## 4) Что теперь primary, а что остаётся fallback-only

### Primary (при корректной production-конфигурации Supabase)
1. Source sync и import runs выполняются через `SupabaseContentRepository`, а не через seed fallback.
2. API-backed metadata ingestion path достижим в live runtime (если env разрешает API path и есть ключ).

### Что остаётся fallback-only
1. Общий fallback-механизм репозитория (`FallbackContentRepository`) остаётся как аварийный режим и зависит от runtime safety env:
   - `ALLOW_FALLBACK_IN_PRODUCTION`
   - `ALLOW_FALLBACK_ON_SUPABASE_ERROR_IN_PRODUCTION`
2. `ingestion-runtime-guard` оставлен для совместимости, но текущий Phase 14B фикс убирает исходную причину его срабатывания в steady-state Supabase runtime.

## 5) Файлы, затронутые в этом проходе
1. `src/server/repositories/supabase-content-repository.ts`
2. `docs/ROADMAP.md`
3. `docs/reports/phase_14B_live_ingestion_runtime_parity_and_api_primary_activation.md`

## 6) Команды, выполненные в этом проходе
1. Аудит кода и трассировка:
   - `rg ... supabase-content-repository.ts content-repository.ts admin-source-service.ts ingestion-job-service.ts`
   - `Get-Content ...` по ключевым файлам ingestion/runtime.
2. Проверки:
   - `npm run lint` — успешно.
   - `npm run build` — успешно.
   - `npm run typecheck` — script отсутствует в `package.json` (честно зафиксировано).

## 7) Результат верификации
1. Build успешен (`next build` без ошибок TypeScript/сборки).
2. Lint успешен.
3. В коде больше нет заглушечного throw-пути “Supabase ingestion path is not active...” в `supabase-content-repository.ts`.
4. Warning path устранён кодово (а не косметическим скрытием текста).

## 8) Что всё ещё требует post-deploy live подтверждения
1. Подтвердить на Vercel после деплоя, что `/admin/sources` в штатной production-конфигурации больше не показывает прежний fallback-runtime warning.
2. Подтвердить end-to-end source sync на live:
   - запуск sync из `/admin/sources`;
   - появление run telemetry в `/admin/imports`;
   - консистентность результатов в `/admin/content`.
3. Отдельно проверить, что в live окружении реально заданы требуемые env для API-backed режима (включая `YOUTUBE_DATA_API_KEY`) и путь действительно работает как API-primary, а не RSS fallback.

## 9) Итог
Phase 14B выполнен как узкий operational pass:
1. устранён кодовый блокер runtime parity в Supabase ingestion path;
2. production source sync path больше не зависит от заглушки/forced fallback по умолчанию;
3. safety-механики dedupe/guards/review-logic сохранены;
4. сборка и линт успешны;
5. остаётся обязательное post-deploy live подтверждение.
