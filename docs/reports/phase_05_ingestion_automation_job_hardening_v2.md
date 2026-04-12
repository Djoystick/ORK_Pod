# Phase 05 - Ingestion Automation Job Hardening v2

Дата: 2026-04-11  
Проект: ORKPOD Archive  
Фаза: 05  
Статус: выполнено (в рамках локального окружения и честных ограничений)

## 1) Стартовое состояние перед Phase 05
На входе были подтверждены рабочие артефакты Phase 01-04:
1. Публичные маршруты: `/`, `/streams`, `/streams/[slug]`, `/about`.
2. Рабочие поиск/фильтры/сортировка в публичном архиве.
3. Репозиторный/service слой и fallback-режим.
4. Admin CMS create/edit/publish.
5. Source registry (`/admin/sources`) и import history (`/admin/imports`).
6. YouTube ingestion v1 с дедупликацией.
7. Источники `orkcut` и `orkstream` присутствуют в реестре (подтверждено в smoke-проверках).

## 2) Цели фазы и что сделано
Целью фазы было превратить admin-triggered ingestion v1 в automation-ready ingestion v2 без разрушения текущих публичных/админ-флоу.

Реализовано:
1. Hardened lifecycle import jobs (расширенные поля и контракты run).
2. Locking/anti-concurrency guard:
   - запрет параллельной синхронизации одного и того же source,
   - sync-all не «топчет» активные source sync-и.
3. Рerun/retry-путь через админку.
4. Расширенный audit trail:
   - фильтрация/summary в `/admin/imports`,
   - детальная страница run `/admin/imports/[id]`.
5. Scheduler-ready entrypoints в сервисном слое (без внедрения внешнего scheduler infra).
6. Fallback-режим сохранен и расширен локальным хранением lock-состояния.

## 3) Ключевые изменения в коде
Изменения выполнены локально, без пересборки проекта «с нуля».

### 3.1 Типы и контракты
Обновлены:
1. `src/types/content.ts`
2. `src/types/repository.ts`

Добавлено/расширено:
1. trigger/requestKey/parentRunId и lock timestamps в `ImportRun`.
2. lock snapshot структуры.
3. сигнатуры репозитория для sync/rerun/sync-all и получения run по id.

### 3.2 Сервис оркестрации ingestion
Добавлен новый orchestration слой:
1. `src/server/services/ingestion-job-service.ts`

Реализованы:
1. Source lock и global sync-all lock.
2. TTL-логика лока и очистка просроченных lock-ов.
3. Единые entrypoints:
   - `runSourceSyncJob`
   - `runAllActiveSourcesJob`
   - `rerunImportRunById`
   - scheduler-ready:
     - `runScheduledSyncAllEntryPoint`
     - `runScheduledSourceSyncEntryPoint`

### 3.3 Репозитории и fallback storage
Обновлены:
1. `src/server/repositories/content-repository.ts`
2. `src/server/repositories/seed-content-repository.ts`
3. `src/server/repositories/supabase-content-repository.ts`
4. `src/server/storage/local-fallback-store.ts`

Что важно:
1. Fallback storage теперь хранит lock snapshot в `data/local-ingestion-locks.json`.
2. Для импортов добавлены поля trigger/request key/lock timestamps.
3. Добавлен `getImportRunById`.
4. Supabase repository приведен к контрактной совместимости (runtime ingestion path все еще fallback-first при отсутствии готового DB runtime).

### 3.4 Admin UI/Actions (ingestion v2)
Обновлены/добавлены:
1. `src/app/admin/sources/actions.ts`
2. `src/app/admin/sources/page.tsx`
3. `src/app/admin/sources/source-registry-form.tsx`
4. `src/app/admin/imports/page.tsx`
5. `src/app/admin/imports/actions.ts`
6. `src/app/admin/imports/import-run-rerun-form.tsx`
7. `src/app/admin/imports/[id]/page.tsx`
8. `src/server/services/admin-source-service.ts`

Итог в UI:
1. `/admin/sources`: видимые sync-state поля (last synced/success/error/in-progress), sync/rerun actions, безопасный sync-all.
2. `/admin/imports`: richer listing, фильтры по статусу/источнику/поиску, summary counters, rerun для неуспешных run.
3. `/admin/imports/[id]`: детальная диагностика run, item-level results, ошибки, rerun.

### 3.5 Supabase schema foundation (migration-ready)
Добавлена миграция:
1. `supabase/migrations/20260411203000_phase_05_ingestion_job_hardening_v2.sql`

В миграции:
1. lock-поля в `source_channels` (`sync_in_progress`, `sync_lock_token`, `sync_lock_expires_at`).
2. run-поля в `import_runs` (`trigger`, `parent_run_id`, `request_key`, `lock_acquired_at`, `lock_released_at`).
3. индексы/constraint для lifecycle и idempotency (`request_key` uniqueness where not null).

### 3.6 Доки и конфиг
Обновлены:
1. `.env.example` (`INGESTION_LOCK_TTL_MS`)
2. `docs/SUPABASE_SETUP.md` (описание lock TTL и fallback lock store)
3. `.gitignore` (исключение `data/local-ingestion-locks.json`)
4. `docs/ROADMAP.md` (обновлен после завершения Phase 05)

Дополнительно:
1. `scripts/phase05-ingestion-smoke.ts` использован для smoke-проверок ingestion v2.

## 4) Locking/idempotency/retry: принятая реализация
Принятые правила:
1. Повторные sync не создают дубликаты по `externalSourceId`.
2. Параллельный запуск sync одного source блокируется lock-механизмом.
3. Sync-all не конфликтует с уже активными source sync-ами, а пропускает/учитывает lock.
4. Retry/rerun выполняется как осознанный action с отдельным trigger-контекстом.
5. `requestKey` добавлен для idempotent запуска и трассировки.

## 5) Правила безопасного обновления imported-контента
Сохранены и уточнены:
1. Дедупликация по стабильному внешнему идентификатору видео.
2. Повторный sync обновляет безопасные source-метаданные.
3. Ручные admin-правки не должны слепо перезатираться импортом.
4. Default-стратегия публикации импортов остается безопасной (draft по умолчанию).

## 6) Проверки и команды
Выполненные команды (существенные):
1. `npm run lint` - успешно.
2. `npm run build` - успешно.
3. `supabase --version` - успешно (`2.78.1`).
4. `supabase db reset` - неуспешно (Docker Desktop недоступен, `docker_engine` pipe not found).
5. `NODE_OPTIONS=--conditions=react-server npx tsx scripts/phase05-ingestion-smoke.ts` - успешно, получены реальные результаты ingestion/dedup/lock/rerun.
6. HTTP smoke-проверка маршрутов через `npm start -- --port ...` + `Invoke-WebRequest` - публичные и админ-маршруты отвечают корректно.

## 7) Результаты проверок (факт)
Подтверждено:
1. Публичные маршруты работают.
2. Админ-маршруты работают, включая `/admin/imports/[id]`.
3. Повторная синхронизация не создает дубликаты.
4. Anti-concurrency guard срабатывает.
5. Rerun-путь выполняется.
6. Draft imported-элементы не утекали в публичный список; published отображаются корректно.
7. Сборка проекта успешна.

## 8) Supabase runtime: что реально применено, а что нет
1. Schema/migration файлы для Phase 05 созданы.
2. Локальное применение миграций к runtime Supabase не подтверждено из-за отсутствующего Docker.
3. Успешное применение миграций не заявляется (не фейкалось).
4. Репозиторный fallback path оставлен рабочим и тестируемым.

## 9) Текущее поведение fallback-режима
Fallback хранит данные локально в `data/`:
1. `local-content-items.json`
2. `local-source-channels.json`
3. `local-import-runs.json`
4. `local-ingestion-locks.json`

Это позволяет тестировать ingestion v2 и audit flow локально даже без поднятого Supabase runtime.

## 10) Что не менялось в этой фазе (сознательно)
1. Не внедрялись comments UI/reactions UI.
2. Не внедрялась финальная production auth/RLS.
3. Не внедрялись scheduler/cron-инфраструктура и полноценные background workers.
4. Не выполнялся визуальный редизайн как основной фокус.
5. Не выполнялся финальный production deployment.

## 11) Ограничения и остаточный долг
1. Runtime-путь Supabase ingestion остается средозависимым до рабочего Docker/Supabase local stack.
2. Временный admin gate остается bootstrap-механизмом, не финальной безопасной auth-моделью.
3. Для production automation нужны отдельные фазы: scheduler, alerting, runbooks, rate-limit/backoff policy.

## 12) Рекомендация на следующий проход
1. Начать Phase 06: foundation для comments/reactions + moderation hooks (сначала schema/services, затем UI).
2. Отдельно запланировать auth/RLS hardening как обязательную production safety-фазу.
3. После этого перейти к infra-автоматизации ingestion (cron/queues/monitoring) без переписывания текущего ingestion-core.
