# Phase 03: Admin Edit/Publish + Source Registry V1

Дата: 2026-04-11  
Проект: ORKPOD Archive (`h:\Work\ORKpod`)

## 1) Стартовое состояние (аудит после Phase 02)

На входе были подтверждены:
1. Публичные маршруты:
   - `/`
   - `/streams`
   - `/streams/[slug]`
   - `/about`
2. Рабочие public-механики:
   - поиск,
   - фильтры,
   - сортировка.
3. Архитектурная база:
   - repository/service слой,
   - fallback режим,
   - Supabase schema scaffolding,
   - admin create flow (`/admin/new`) с временным bootstrap gate.

Проект не пересобирался с нуля, работа продолжена поверх существующего кода.

## 2) Что реализовано в Phase 03

## 2.1 Admin CMS workflow v1
Добавлены маршруты и функциональность:
1. `/admin`:
   - dashboard,
   - счётчики по статусам контента,
   - quick links на create/content/sources.
2. `/admin/content`:
   - список контента,
   - статусы,
   - фильтры по status/source type/platform/category,
   - поиск,
   - переход в редактирование.
3. `/admin/content/[id]`:
   - редактирование существующей записи,
   - поля: title/slug/excerpt/description/body/category/series/platform/external URL/published date/source type/status,
   - сохранение через repository/service.
4. Status workflow:
   - publish,
   - unpublish to draft,
   - archive,
   - hard delete не добавлялся.

## 2.2 Source channel registry v0
Добавлен admin-реестр источников:
1. `/admin/sources`:
   - список source channels,
   - форма создания source channel.
2. Поля создания:
   - title,
   - slug,
   - platform,
   - external channel id,
   - channel URL,
   - active/inactive,
   - notes.
3. Реестр подключён через repository/service слой и поддерживает fallback.

## 2.3 Учтены обязательные каналы для будущего ingestion
Каналы заранее учтены (prefill выполнен):
1. `orkcut` -> `https://www.youtube.com/@orkcut/videos`
2. `orkstream` -> `https://www.youtube.com/@orkstream/videos`

Где зафиксированы:
1. `src/data/source-channels.ts` (fallback seed)
2. `data/local-source-channels.json` (локальный fallback registry)
3. `supabase/seed.sql` (DB seed)

## 2.4 Централизация admin gate
Временный gate перенесён в централизованный utility:
1. `src/server/auth/admin-gate.ts`
2. Единый контекст и логика для всех admin-маршрутов:
   - `/admin`
   - `/admin/new`
   - `/admin/content`
   - `/admin/content/[id]`
   - `/admin/sources`
3. В production без `ADMIN_BOOTSTRAP_KEY` записи блокируются.
4. Это всё ещё временный bootstrap, не production auth.

## 2.5 Расширение repository/service слоя
Контракт и реализации расширены методами:
1. `listAdminContentItems`
2. `getAdminItemById`
3. `updateContentItem`
4. `setContentItemStatus`
5. `listSourceChannels`
6. `createSourceChannel`

Изменения внесены в:
1. `src/types/repository.ts`
2. `src/server/repositories/seed-content-repository.ts`
3. `src/server/repositories/supabase-content-repository.ts`
4. `src/server/repositories/content-repository.ts` (fallback wrapper)
5. `src/server/services/admin-content-service.ts`
6. `src/server/services/admin-source-service.ts`

## 2.6 Fallback mode (актуализирован)
1. Контентный fallback store:
   - `data/local-content-items.json` (создаётся автоматически),
   - legacy bootstrap из `data/manual-content-items.json`.
2. Source registry fallback store:
   - `data/local-source-channels.json`.
3. Публичный архив показывает только `published`.
4. Draft/archived доступны в admin-листинге.

## 2.7 Публичная совместимость
Сохранена работоспособность public части:
1. Home/Streams/Detail/About не сломаны.
2. Для корректного отражения admin-изменений `/` и `/streams` переведены в dynamic rendering (`force-dynamic`), чтобы опубликованные обновления были видны без пересборки.

## 3) Изменения в Supabase/DB слоях

## 3.1 Миграции
Добавлена новая миграция:
1. `supabase/migrations/20260411113355_phase_03_admin_cms_source_registry_v1.sql`
   - `source_channels.is_active`
   - `source_channels.notes`
   - индекс по `is_active`.

## 3.2 Seed
Обновлён `supabase/seed.sql`:
1. prefill source channels `orkcut`, `orkstream`, `orkpod-youtube`.

## 3.3 Фактическое применение миграций
Попытка запуска:
1. `supabase db reset`

Результат:
1. **неуспешно** (Docker Desktop недоступен в окружении).
2. Миграции и seed подготовлены, но локально фактически не применены.
3. В отчёте это отражено честно, без имитации применённой БД.

## 4) Команды, которые выполнялись

Основные команды прохода:
1. `supabase --version`
2. `supabase migration new phase_03_admin_cms_source_registry_v1`
3. `npm run lint`
4. `npm run build`
5. `npm start -- --port ...` (smoke-check public/admin маршрутов)
6. `supabase db reset` (неуспешно из-за отсутствия Docker)

Дополнительные проверки:
1. HTTP smoke-check:
   - `/`
   - `/streams`
   - `/streams/[slug]`
   - `/about`
   - `/admin`
   - `/admin/new`
   - `/admin/content`
   - `/admin/sources`
2. Проверка поведения status visibility (через временную модификацию fallback-store и rollback):
   - edited published item виден в public `/streams`,
   - draft item не попадает в public,
   - draft item виден в admin list при включённом bootstrap key.
3. Проверка обязательных source channels:
   - `orkcut` и `orkstream` видны в `/admin/sources`.

## 5) Build/Run статус

1. `npm run lint`: успешно.
2. `npm run build`: успешно.
3. Public/Admin маршруты: отвечают `200` в smoke-проверках.

## 6) Изменённые/добавленные ключевые файлы

Добавлено:
1. `src/server/auth/admin-gate.ts`
2. `src/server/services/admin-source-service.ts`
3. `src/app/admin/content/page.tsx`
4. `src/app/admin/content/[id]/page.tsx`
5. `src/app/admin/content/[id]/edit-content-form.tsx`
6. `src/app/admin/content/[id]/actions.ts`
7. `src/app/admin/sources/page.tsx`
8. `src/app/admin/sources/source-registry-form.tsx`
9. `src/app/admin/sources/actions.ts`
10. `src/server/storage/local-fallback-store.ts`
11. `data/local-source-channels.json`
12. `supabase/migrations/20260411113355_phase_03_admin_cms_source_registry_v1.sql`
13. `docs/reports/phase_03_admin_edit_publish_source_registry_v1.md`

Изменено (ключевое):
1. `src/types/content.ts`
2. `src/types/repository.ts`
3. `src/server/repositories/seed-content-repository.ts`
4. `src/server/repositories/supabase-content-repository.ts`
5. `src/server/repositories/content-repository.ts`
6. `src/server/services/admin-content-service.ts`
7. `src/app/admin/page.tsx`
8. `src/app/admin/layout.tsx`
9. `src/app/admin/new/*`
10. `src/app/page.tsx`
11. `src/app/streams/page.tsx`
12. `src/data/source-channels.ts`
13. `supabase/seed.sql`
14. `docs/ROADMAP.md`
15. `docs/SUPABASE_SETUP.md`
16. `.gitignore`

Удалено/заменено:
1. `src/server/storage/manual-item-store.ts` (заменён на централизованный local fallback store).

## 7) Что осталось ограничением

1. Нет финального production auth/RBAC/RLS.
2. Admin gate всё ещё bootstrap-временный механизм.
3. Полный ingestion pipeline для YouTube ещё не реализован.
4. Comments/reactions UI не реализованы (вне scope этой фазы).

## 8) Что намеренно отложено

1. Полноценный ingestion runtime (jobs/scheduler/webhooks/retries).
2. Публичный comments/reactions интерфейс.
3. Финальный auth/RLS hardening.
4. Deployment/ops hardening.

## 9) Следующий рекомендуемый проход

1. Реализовать Phase 04: multi-channel YouTube ingestion v1 для:
   - `orkcut`
   - `orkstream`
2. Добавить job lifecycle (queued/running/success/failed) и retry.
3. Добавить admin-видимость import history/audit trail.
