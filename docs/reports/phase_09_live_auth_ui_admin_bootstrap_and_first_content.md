# Phase 09 — Live Auth UI, Admin Bootstrap и First Content

## 1. Контекст и цель фазы
Цель прохода: закрыть live usability gap после Phase 08 без расширения scope:
1. Добавить видимый Sign in / Sign out UX.
2. Подключить реальный Supabase session flow (вход/выход + cookie session detection).
3. Сделать явное admin recognition для аутентифицированного пользователя.
4. Добавить практичный bootstrap первых published записей для реального теста detail/comments/reactions.

## 2. Фактическое стартовое состояние (аудит)
На старте в коде уже были:
1. Public маршруты `/`, `/streams`, `/streams/[slug]`, `/about`.
2. Admin CMS, source registry, ingestion, moderation.
3. Repository/service слой и fallback контур.
4. Auth/RLS foundation (Phase 07/08), но:
   - не было явного публичного sign-in/sign-out entrypoint,
   - не было завершенного UX для live session flow,
   - не было удобного owner flow для быстрого bootstrap первых published записей в live.

## 3. Что реализовано в этой фазе

### 3.1 Видимый auth UI в публичной оболочке
Сделано:
1. `SiteShell` стал session-aware и передает auth/admin состояние в header.
2. В `SiteHeader` добавлены:
   - кнопка `Войти` (когда сессии нет),
   - кнопка `Выйти` (когда сессия есть),
   - email/идентификатор текущей сессии,
   - индикатор admin recognition (`Admin доступ` / `Admin ограничен`).

### 3.2 Реальный Supabase sign-in/sign-out flow
Сделано:
1. Добавлен route `/auth/sign-in`.
2. Добавлена форма входа (email/password) с server action.
3. Реализован вход через Supabase `signInWithPassword` (anon key path).
4. Реализована установка auth cookies на сервере:
   - access token cookie,
   - refresh token cookie.
5. Реализован sign-out server action с очисткой cookies.

### 3.3 Session-aware admin recognition
Сделано:
1. Расширен `admin-gate`:
   - проверка по `ADMIN_ALLOWED_EMAILS` / `ADMIN_ALLOWED_USER_IDS`,
   - проверка по таблице `admin_users` (`is_active=true`).
2. Если пользователь не admin — write-path остается заблокирован.
3. В UI добавлена более явная коммуникация статуса доступа.

### 3.4 First content bootstrap для live-тестов
Сделано:
1. Добавлен owner-only сервис `bootstrapInitialPublishedContent`.
2. Добавлен admin action и UI-кнопка `Bootstrap published` на `/admin`.
3. Flow создает небольшой стартовый набор published записей через текущий repository/service слой.
4. Это позволяет быстро получить видимые detail pages для теста comments/reactions/moderation в live.

### 3.5 Улучшения community testability
Сделано:
1. В community-блоке detail страницы добавлены прямые ссылки на `/auth/sign-in` при write-ограничениях.
2. Пользователь получает понятный путь к авторизации перед comment/reaction действиями.

## 4. Измененные файлы

### 4.1 Добавлены
1. `src/app/auth/actions.ts`
2. `src/app/auth/sign-in/page.tsx`
3. `src/app/auth/sign-in/sign-in-form.tsx`
4. `src/server/auth/supabase-session-cookies.ts`
5. `src/lib/redirect.ts`
6. `src/server/services/content-bootstrap-service.ts`
7. `src/app/admin/actions.ts`
8. `src/app/admin/bootstrap-published-form.tsx`

### 4.2 Обновлены
1. `src/components/layout/site-shell.tsx`
2. `src/components/layout/site-header.tsx`
3. `src/server/auth/supabase-auth.ts`
4. `src/server/auth/admin-gate.ts`
5. `src/components/admin/admin-gate-notice.tsx`
6. `src/components/community/community-block.tsx`
7. `src/app/admin/page.tsx`
8. `src/app/admin/layout.tsx`
9. `.env.example`
10. `docs/SUPABASE_SETUP.md`
11. `docs/VERCEL_SETUP.md`
12. `docs/ROADMAP.md`

## 5. Команды, выполненные в этом проходе
1. `npm run build` — успешно.
2. `npm run lint` — успешно.

Дополнительно: выполнялся аудит кода через `rg`/`Get-Content` по auth/gate/repository/admin/community слоям.

## 6. Проверка результата по факту

### 6.1 Подтверждено локально
1. Проект успешно собирается.
2. Новый route `/auth/sign-in` попадает в build output.
3. Кодовые пути sign-in/sign-out/session-aware header собраны без type/lint ошибок.
4. Admin bootstrap flow добавлен и подключен в `/admin` UI.

### 6.2 Честно НЕ подтверждено в этом окружении
1. Полный live E2E вход/выход на реальном Vercel домене.
2. Фактическая запись в live Supabase через кнопку bootstrap (в этом проходе не выполнялась принудительно).
3. End-to-end проверка admin recognition на конкретном live пользователе allowlist/admin_users.

## 7. Как теперь работает fallback
Fallback режим сохранен:
1. Если Supabase runtime недоступен, приложение продолжает работать через локальные fallback stores.
2. Разделение production path vs fallback path сохранено и дополнительно отражено в документации.
3. Новые auth UI элементы не удаляют fallback поведение и не подменяют его как production-safe.

## 8. Ограничения и технический долг после фазы
1. Автоматический refresh access token в фоне не внедрялся (phase scope не расширялся).
2. Нужен реальный post-deploy smoke на live (auth/admin/community/moderation/ingestion).
3. Для окончательной production уверенности нужен отдельный operational pass с runbook-фиксацией.

## 9. Рекомендованный следующий проход
1. Выполнить live smoke по `docs/VERCEL_SETUP.md`.
2. Проверить сценарий “новый auth user -> admin recognition через allowlist/admin_users”.
3. Выполнить `Bootstrap published` на live при пустом архиве и зафиксировать результат.
4. После стабилизации перейти к post-live hardening/observability и плановым улучшениям UX.

