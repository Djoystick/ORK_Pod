# Phase 07 - Auth/RLS Hardening для production write paths

Дата: 2026-04-12  
Проект: ORKPOD Archive  
Фаза: 07  
Статус: выполнено в рамках текущего окружения (с честными ограничениями по локальному Supabase runtime)

## 1) Стартовое состояние (аудит после Phase 06)
На старте подтверждено:
1. Публичные маршруты работали: `/`, `/streams`, `/streams/[slug]`, `/about`.
2. Работали админ-маршруты CMS/ingestion/moderation:
   - `/admin`
   - `/admin/new`
   - `/admin/content`
   - `/admin/content/[id]`
   - `/admin/sources`
   - `/admin/imports`
   - `/admin/imports/[id]`
   - `/admin/moderation`
3. Существовал временный bootstrap admin gate.
4. Community write paths работали через guest cookie модель.
5. Repository/service/fallback архитектура была уже стабилизирована.

## 2) Выбранная auth-модель и rationale
Принята двухрежимная модель, чтобы одновременно:
1. не ломать локальную разработку;
2. задать production-направленный Supabase путь.

### 2.1 Режим admin auth
1. `ORKPOD_AUTH_STRATEGY=local_bootstrap`
   - fallback/dev режим;
   - локально возможен dev-admin (`ALLOW_LOCAL_DEV_ADMIN=true`);
   - вне localhost write требует `ADMIN_BOOTSTRAP_KEY`.
2. `ORKPOD_AUTH_STRATEGY=supabase_auth`
   - production-направленный режим;
   - доступ к admin write путям только при валидной Supabase-сессии;
   - дополнительно проверяется allowlist:
     - `ADMIN_ALLOWED_EMAILS`
     - `ADMIN_ALLOWED_USER_IDS`

### 2.2 Режим community write
1. `ORKPOD_COMMUNITY_WRITE_MODE=guest_local`
   - dev/fallback сценарий (не production-safe).
2. `ORKPOD_COMMUNITY_WRITE_MODE=supabase_auth_required`
   - комментарии/реакции доступны только с Supabase-auth сессией.

Rationale:
1. В dev/fallback проект остается работоспособным.
2. В production можно переключиться на auth-обязательный контур без переписывания бизнес-логики.

## 3) Что реализовано по admin hardening
### 3.1 Централизованный admin authorization слой
Обновлен:
1. `src/server/auth/admin-gate.ts`

Что добавлено:
1. Стратегии `local_bootstrap` и `supabase_auth`.
2. Проверка allowlist в Supabase auth режиме.
3. Асинхронный `assertAdminWriteAccess` с единым контрактом deny/allow.

### 3.2 Supabase principal resolution
Добавлен:
1. `src/server/auth/supabase-auth.ts`

Функции:
1. Получение Supabase access token из cookie (`ORKPOD_SUPABASE_ACCESS_TOKEN_COOKIE`).
2. Проверка user session через Supabase (`auth.getUser(token)`).

### 3.3 Приведение privileged сервисов к единому guard
Обновлены:
1. `src/server/services/admin-content-service.ts`
2. `src/server/services/admin-source-service.ts`
3. `src/server/services/community-service.ts` (admin moderation write path)

Что сделано:
1. Все privileged write paths используют `await assertAdminWriteAccess(...)`.
2. Снижено доверие к невалидированному клиентскому контексту.

## 4) Что реализовано по community write hardening
### 4.1 Централизованный community gate
Добавлен:
1. `src/server/auth/community-gate.ts`

Что сделано:
1. Явное разделение write-mode (`guest_local` vs `supabase_auth_required`).
2. Блокировка write-path при отсутствии требуемого режима/сессии.

### 4.2 Abuse/rate-limit hooks
Добавлен:
1. `src/server/security/write-rate-limit.ts`

Использование:
1. В `src/app/streams/[slug]/community-actions.ts`:
   - лимиты на комментарии;
   - лимиты на реакции.
2. Добавлен honeypot field для базовой антибот-проверки комментариев.

### 4.3 Community UI-поведение под новый access model
Обновлены:
1. `src/components/community/community-block.tsx`
2. `src/app/streams/[slug]/page.tsx`
3. `src/server/services/community-service.ts`

Что сделано:
1. На detail-странице теперь видно, доступен ли write-path.
2. Формы comments/reactions отключаются, если текущий режим не разрешает запись.
3. Политика write-mode и moderation явно сообщается в UI.

## 5) RLS/policy foundation (core результат фазы)
Добавлена migration-ready SQL:
1. `supabase/migrations/20260412001500_phase_07_auth_rls_hardening_write_paths.sql`

Ключевые изменения:
1. Таблица `admin_users` (owner/admin allowlist модель).
2. Поля для auth-attribution:
   - `comments.author_user_id`
   - `reactions.actor_user_id`
3. `public.is_admin_user()` helper function.
4. Включение RLS на ключевых таблицах.
5. Политики для:
   - content read (published only),
   - comments read/write/moderation,
   - reactions read/write,
   - admin manage для CMS/ingestion таблиц.

## 6) Server actions / service hardening (дополнительно)
Обновлены write entrypoints:
1. `src/app/streams/[slug]/community-actions.ts`
2. `src/app/admin/*/actions.ts` через обновленные сервисы и gate-assert логику.

Смысл:
1. Привилегированные операции не зависят от client-only предположений.
2. Правила допуска централизованы в auth/gate слоях.

## 7) Изменения fallback режима
Fallback сохранен и честно отделен от production поведения:
1. Dev/fallback continue-path работает через локальные хранилища.
2. Добавлен локальный store для rate-limit:
   - `data/local-write-rate-limits.json`
3. В fallback режиме community write возможен при `guest_local`.
4. В production-направленном режиме можно переключиться на `supabase_auth_required`.

## 8) Обновленные документы
Обновлены:
1. `.env.example` (новые auth/community/security переменные)
2. `docs/SUPABASE_SETUP.md` (auth model, RLS expectations, runtime ограничения)
3. `docs/ROADMAP.md` (состояние после Phase 07)

## 9) Команды и проверки
Выполненные команды:
1. `npm run lint` - успешно.
2. `npm run build` - успешно.
3. `npm run start -- --port 3114` + `Invoke-WebRequest` smoke маршрутов - успешно.
4. `supabase --version` - успешно (`2.78.1`).
5. `supabase db reset` - неуспешно из-за отсутствующего Docker runtime.
6. `npx tsx scripts/phase07-auth-smoke.ts` - успешно.
7. `npx tsx scripts/phase06-community-smoke.ts` - успешно.

## 10) Результаты self-check
Подтверждено:
1. Публичные страницы работают.
2. Админ-маршруты доступны и не сломаны.
3. Build проходит.
4. Community flows (comment/reaction/moderation visibility rules) работают.
5. Админ write-path без корректного доступа блокируется.
6. Режим `supabase_auth_required` для community write без сессии корректно не дает write.

## 11) Что реально применено vs что подготовлено
Реально применено в коде:
1. Новый auth/gate слой.
2. Hardening server actions/services.
3. Community write hardening и rate-limit hooks.
4. UI-месседжинг/disable-поведение под access model.

Подготовлено migration-ready, но не применено локально:
1. RLS/policies SQL из Phase 07 migration.
2. Полный runtime путь Supabase policy enforcement.

Причина:
1. `supabase db reset` не смог выполниться локально без Docker Desktop.

## 12) Остаточный долг и следующий проход
Осталось до live production-ready состояния:
1. Применить миграции и RLS в реальном Supabase runtime.
2. Подключить live Supabase auth/session flow (вместе с cookie/session инфраструктурой).
3. Выполнить deployment hardening (Vercel + Supabase live setup).

Рекомендуемый следующий этап:
1. Phase 08 - deployment hardening и live environment validation для auth/RLS контуров.
