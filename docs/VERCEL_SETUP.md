# Vercel Setup (Live Deployment Guide)

## 1. Цель
Практический чеклист для вывода ORKPOD Archive в live на Vercel с Supabase backend.

Документ описывает:
1. Что нужно настроить в Vercel.
2. Какие env переменные обязательны.
3. Что проверить сразу после деплоя.
4. Какие риски остаются до полного production hardening.

## 2. Пререквизиты
1. Репозиторий в git с актуальными миграциями Supabase.
2. Live Supabase project создан.
3. Миграции применены к live Supabase (см. `docs/SUPABASE_SETUP.md`).
4. В `admin_users` есть хотя бы один активный админ.

## 3. Vercel проект
1. Import repository в Vercel.
2. Framework preset: `Next.js`.
3. Build command: `npm run build`.
4. Install command: `npm install`.
5. Output: стандартный Next.js output.

## 4. Обязательные Environment Variables (Vercel)
### 4.1 Supabase
1. `NEXT_PUBLIC_SUPABASE_URL`
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. `SUPABASE_SERVICE_ROLE_KEY`

### 4.2 Auth / Access strategy
1. `ORKPOD_AUTH_STRATEGY=supabase_auth`
2. `ORKPOD_COMMUNITY_WRITE_MODE=supabase_auth_required`
3. `ORKPOD_SUPABASE_ACCESS_TOKEN_COOKIE=orkpod_supabase_access_token` (или ваше имя cookie)
4. `ADMIN_ALLOWED_EMAILS` и/или `ADMIN_ALLOWED_USER_IDS`

### 4.3 Production safety flags
1. `ALLOW_BOOTSTRAP_ADMIN_IN_PRODUCTION=false`
2. `ALLOW_GUEST_COMMUNITY_WRITES_IN_PROD=false`
3. `ALLOW_FALLBACK_IN_PRODUCTION=false`
4. `ALLOW_FALLBACK_ON_SUPABASE_ERROR_IN_PRODUCTION=false`

### 4.4 Optional tuning
1. `YOUTUBE_INGESTION_MAX_ITEMS_PER_SOURCE`
2. `INGESTION_LOCK_TTL_MS`

## 5. Runtime caveats (важно)
1. В проекте зафиксирован `runtime = "nodejs"` на App Router layout.
2. Fallback stores используют filesystem и предназначены только для dev/fallback.
3. На Vercel filesystem не должен быть relied-on как persistent storage.
4. Production deployment должен идти через Supabase path, а не через fallback.

## 6. Post-deploy smoke checks
### 6.0 Preflight env check
Перед деплоем можно запустить локальную проверку обязательных production env:
```powershell
powershell -File scripts/check-prod-env.ps1
```

### 6.1 Быстрый HTTP smoke
Используйте скрипт:
```powershell
powershell -File scripts/live-smoke-check.ps1 -BaseUrl https://<your-domain>
```

### 6.2 Ручной functional smoke
Проверьте:
1. Public:
   - `/`
   - `/streams`
   - `/streams/[slug]`
   - `/about`
2. Admin:
   - `/admin` и подстраницы открываются
   - write-операции без авторизации не проходят
   - write-операции с авторизованным админом проходят
3. Community:
   - comments/reactions write работают только под выбранной auth policy
4. Moderation:
   - approve/hide/reject доступны только admin-пользователю
5. Ingestion:
   - source sync trigger работает под admin-правами
6. Visibility:
   - draft не утекают в public
   - published видимы публично

## 7. Что не считается завершенным автоматически
1. Сам факт успешного `vercel deploy` не подтверждает корректность RLS/policies.
2. Без проверки реального auth/session flow deployment не считается production-safe.
3. Без post-deploy smoke и проверок прав доступа релиз не завершен.

## 8. Риски и ограничения
1. Если allowlist admin не задан, admin write paths будут заблокированы.
2. Если cookie сессии Supabase не настроена корректно, `supabase_auth` write-path не заработает.
3. Включение bootstrap/fallback флагов в production повышает риск небезопасного поведения.

## 9. Рекомендуемый rollout порядок
1. Применить Supabase миграции и заполнить `admin_users`.
2. Настроить env vars в Vercel.
3. Deploy.
4. Прогнать smoke-check script и ручной functional checklist.
5. Зафиксировать результаты в release notes/runbook.
