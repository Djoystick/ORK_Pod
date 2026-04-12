# Vercel Setup (Live Deployment Guide)

## 1. Цель
Практический чеклист для вывода ORKPOD Archive в live на Vercel с Supabase backend.

Документ отвечает на вопросы:
1. Что обязательно настроить в Vercel.
2. Какие env переменные требуются.
3. Что проверить сразу после деплоя.
4. Как проверить auth/admin/community контуры после Phase 09.

## 2. Пререквизиты
1. Репозиторий содержит актуальные миграции Supabase.
2. В live Supabase проекте миграции применены.
3. Есть хотя бы один auth-пользователь для входа.
4. Настроен admin lookup:
   - `ADMIN_ALLOWED_*`, и/или
   - `admin_users`.

## 3. Vercel проект
1. Framework preset: `Next.js`.
2. Install command: `npm install`.
3. Build command: `npm run build`.
4. Runtime: Node.js (в проекте используется server runtime в App Router).

## 4. Environment Variables (Vercel)

### 4.1 Supabase
1. `NEXT_PUBLIC_SUPABASE_URL`
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. `SUPABASE_SERVICE_ROLE_KEY`

### 4.2 Auth / access strategy
1. `ORKPOD_AUTH_STRATEGY=supabase_auth`
2. `ORKPOD_COMMUNITY_WRITE_MODE=supabase_auth_required`
3. `ORKPOD_SUPABASE_ACCESS_TOKEN_COOKIE=orkpod_supabase_access_token` (или кастом)
4. `ORKPOD_SUPABASE_REFRESH_TOKEN_COOKIE=orkpod_supabase_refresh_token` (или кастом)
5. `ADMIN_ALLOWED_EMAILS` и/или `ADMIN_ALLOWED_USER_IDS` (если используется env allowlist)

### 4.3 Production safety
1. `ALLOW_BOOTSTRAP_ADMIN_IN_PRODUCTION=false`
2. `ALLOW_GUEST_COMMUNITY_WRITES_IN_PROD=false`
3. `ALLOW_FALLBACK_IN_PRODUCTION=false`
4. `ALLOW_FALLBACK_ON_SUPABASE_ERROR_IN_PRODUCTION=false`

### 4.4 Optional tuning
1. `YOUTUBE_INGESTION_MAX_ITEMS_PER_SOURCE`
2. `INGESTION_LOCK_TTL_MS`

## 5. Post-deploy smoke checklist

### 5.1 Технический preflight
1. Локально перед деплоем:
   - `powershell -File scripts/check-prod-env.ps1`

### 5.2 HTTP smoke
1. После деплоя:
   - `powershell -File scripts/live-smoke-check.ps1 -BaseUrl https://<your-domain>`

### 5.3 Функциональные проверки
1. Public:
   - `/`
   - `/streams`
   - `/streams/[slug]`
   - `/about`
2. Auth:
   - видно кнопку `Войти` в header
   - `/auth/sign-in` открывается
   - успешный вход меняет header на состояние с `Выйти`
3. Admin recognition:
   - allowlisted/admin_users пользователь получает admin-доступ
   - не-admin пользователь не получает write-доступ
4. Community:
   - комментарии/реакции в production требуют auth в соответствии с policy
5. Moderation:
   - approve/hide/reject доступны только admin
6. Ingestion:
   - sync actions работают только для admin
7. Visibility:
   - draft не видны публично
   - published доступны в архиве и detail

## 6. Важная граница production vs fallback
1. На Vercel нельзя полагаться на локальные fallback файлы как на постоянное хранилище.
2. Production-доступ должен идти через Supabase path.
3. Fallback — только dev/аварийный контур, не security-модель для live.

## 7. Первый контент после деплоя
Если live архив пуст:
1. Войдите под admin-пользователем.
2. Откройте `/admin`.
3. Выполните `Bootstrap published`.
4. Проверьте, что появились записи в `/streams` и открываются detail pages.

## 8. Что не считается автоматически завершенным
1. Успешный `vercel deploy` сам по себе не подтверждает корректность RLS/policies.
2. Без реальной проверки входа/выхода и прав доступа релиз нельзя считать production-validated.
3. Без smoke и функционального прогона релиз не завершен операционно.

