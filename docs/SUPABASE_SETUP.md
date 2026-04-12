# Supabase Setup (Live + Local)

## 1. Назначение
Документ описывает практический путь для ORKPOD Archive:
1. Настройка live Supabase проекта.
2. Ожидаемая auth/session модель после Phase 09.
3. Что уже реализовано в коде, а что остается ручной инфраструктурной задачей.

## 2. Обязательные переменные окружения
Минимум для production-контура:
1. `NEXT_PUBLIC_SUPABASE_URL`
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. `SUPABASE_SERVICE_ROLE_KEY`
4. `ORKPOD_AUTH_STRATEGY=supabase_auth`
5. `ORKPOD_COMMUNITY_WRITE_MODE=supabase_auth_required`
6. `ORKPOD_SUPABASE_ACCESS_TOKEN_COOKIE` (опционально, если нужно нестандартное имя)
7. `ORKPOD_SUPABASE_REFRESH_TOKEN_COOKIE` (опционально, если нужно нестандартное имя)

Admin lookup (минимум один способ):
1. `ADMIN_ALLOWED_EMAILS` и/или `ADMIN_ALLOWED_USER_IDS`
2. или заполненная таблица `admin_users` (с `is_active=true`)

Рекомендуемые production safety flags:
1. `ALLOW_BOOTSTRAP_ADMIN_IN_PRODUCTION=false`
2. `ALLOW_GUEST_COMMUNITY_WRITES_IN_PROD=false`
3. `ALLOW_FALLBACK_IN_PRODUCTION=false`
4. `ALLOW_FALLBACK_ON_SUPABASE_ERROR_IN_PRODUCTION=false`

## 3. Миграции (порядок)
Ожидаемая цепочка:
1. `20260411094038_phase_02_backbone_admin_v0.sql`
2. `20260411113355_phase_03_admin_cms_source_registry_v1.sql`
3. `20260411183000_phase_04_youtube_ingestion_v1.sql`
4. `20260411203000_phase_05_ingestion_job_hardening_v2.sql`
5. `20260411234500_phase_06_community_foundation_v1.sql`
6. `20260412001500_phase_07_auth_rls_hardening_write_paths.sql`

## 4. Что должно быть настроено в live Supabase
1. Создан Supabase project.
2. Применены миграции.
3. Проверены RLS policies на чтение/запись.
4. Созданы auth-пользователи (email/password или выбранный провайдер).
5. Настроен хотя бы один admin lookup:
   - env allowlist (`ADMIN_ALLOWED_*`), или
   - запись в `admin_users` с `user_id` нужного пользователя.

## 5. Реализованный auth/session flow (Phase 09)
Реализовано в приложении:
1. Публичный route входа: `/auth/sign-in`.
2. Видимые кнопки входа/выхода в `SiteHeader`.
3. Серверный sign-in path через Supabase `signInWithPassword`.
4. Серверный sign-out path с очисткой auth cookies.
5. Session detection на сервере через cookie access token.
6. Admin recognition:
   - через `ADMIN_ALLOWED_*`,
   - и через таблицу `admin_users`.

Важно:
1. Это production-направленный путь, но не заменяет финальную infra-проверку в live.
2. Авто-refresh access token на фоне не добавлен в этом проходе; используется явный вход и cookie-сессия.

## 6. Первый контент для live-тестов
Чтобы не оставаться с пустым публичным архивом:
1. В `/admin` добавлена owner-only action `Bootstrap published`.
2. Action создает небольшой стартовый набор published записей через repository/service слой.
3. После выполнения становятся доступны реальные detail pages для проверки comments/reactions/moderation.

## 7. Локальный цикл через Supabase CLI (если доступен Docker)
1. `supabase start`
2. `supabase db reset`
3. `supabase stop`

Если Docker недоступен:
1. SQL остается migration-ready.
2. Локальное runtime-применение не подтверждается.

## 8. Честная граница fallback режима
Fallback режим сохраняется для local/dev:
1. `data/local-content-items.json`
2. `data/local-source-channels.json`
3. `data/local-import-runs.json`
4. `data/local-ingestion-locks.json`
5. `data/local-comments.json`
6. `data/local-reactions.json`
7. `data/local-write-rate-limits.json`

Это не production-safe контур хранения и доступа.

