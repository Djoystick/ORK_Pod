# Supabase Setup (Live + Local)

## 1. Назначение документа
Этот документ описывает:
1. Что нужно для реального (live) Supabase окружения.
2. Что можно проверить локально.
3. Какие вещи в текущем репозитории только подготовлены и требуют ручного применения.

## 2. Обязательные переменные окружения
Минимум для production-пути:
1. `NEXT_PUBLIC_SUPABASE_URL`
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. `SUPABASE_SERVICE_ROLE_KEY`
4. `ORKPOD_AUTH_STRATEGY=supabase_auth`
5. `ORKPOD_COMMUNITY_WRITE_MODE=supabase_auth_required`
6. `ORKPOD_SUPABASE_ACCESS_TOKEN_COOKIE` (если используется нестандартное имя cookie)
7. `ADMIN_ALLOWED_EMAILS` и/или `ADMIN_ALLOWED_USER_IDS`

Рекомендуемые production safety flags:
1. `ALLOW_BOOTSTRAP_ADMIN_IN_PRODUCTION=false`
2. `ALLOW_GUEST_COMMUNITY_WRITES_IN_PROD=false`
3. `ALLOW_FALLBACK_IN_PRODUCTION=false`
4. `ALLOW_FALLBACK_ON_SUPABASE_ERROR_IN_PRODUCTION=false`

## 3. Migration chain (порядок)
Текущая последовательность миграций:
1. `20260411094038_phase_02_backbone_admin_v0.sql`
2. `20260411113355_phase_03_admin_cms_source_registry_v1.sql`
3. `20260411183000_phase_04_youtube_ingestion_v1.sql`
4. `20260411203000_phase_05_ingestion_job_hardening_v2.sql`
5. `20260411234500_phase_06_community_foundation_v1.sql`
6. `20260412001500_phase_07_auth_rls_hardening_write_paths.sql`

## 4. Что вручную настроить в live Supabase
1. Создать проект Supabase.
2. Применить миграции (`supabase db push` или через CI pipeline).
3. Проверить RLS/policies после применения миграций.
4. Заполнить `admin_users` (owner/admin allowlist) минимум одним админ-пользователем.
5. Настроить Auth-поток так, чтобы сервер видел валидный access token в cookie `ORKPOD_SUPABASE_ACCESS_TOKEN_COOKIE`.

Важно:
1. В текущем проекте нет полного production sign-in UI.
2. Поэтому live auth flow (выдача cookie токена) требует отдельной ручной интеграции/настройки.

## 5. Auth и access модель (фактическая)
1. Admin write paths:
   - в production ожидается `ORKPOD_AUTH_STRATEGY=supabase_auth`;
   - доступ разрешается только пользователям из allowlist.
2. Community writes:
   - в production ожидается `ORKPOD_COMMUNITY_WRITE_MODE=supabase_auth_required`.
3. Fallback в production:
   - по умолчанию отключен (через safety flags).

## 6. Локальный цикл Supabase CLI
Если Docker доступен:
1. `supabase start`
2. `supabase db reset`
3. `supabase stop`

Если Docker недоступен:
1. Миграции остаются migration-ready.
2. Runtime application не подтверждается локально.

## 7. Как отличить подготовку от реального применения
Реально применено:
1. SQL миграции находятся в репозитории.
2. Код и guards ожидают `supabase_auth` и RLS модель.

Не подтверждено в текущем окружении без Docker/доступа к live проекту:
1. Фактическое применение миграций в runtime БД.
2. Фактическая проверка RLS/policies на live Supabase.
3. Полный end-to-end login/session flow в live.

## 8. Fallback режим (честная граница)
Локально без Supabase runtime проект остается работоспособным через fallback stores:
1. `data/local-content-items.json`
2. `data/local-source-channels.json`
3. `data/local-import-runs.json`
4. `data/local-ingestion-locks.json`
5. `data/local-comments.json`
6. `data/local-reactions.json`
7. `data/local-write-rate-limits.json`

Это dev/fallback контур и не production-safe security модель.
