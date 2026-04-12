# Phase 08 - Deployment hardening и live environment validation

Дата: 2026-04-12  
Проект: ORKPOD Archive  
Фаза: 08  
Статус: выполнено в части deployment hardening и live-path подготовки (без фейка live deploy)

## 1) Стартовое состояние (аудит после Phase 07)
На старте подтверждено:
1. Публичные страницы и админ-контур существуют и работают в локальном контуре.
2. Auth/gate hardening foundation из Phase 07 уже присутствует.
3. Migration-ready RLS/policy SQL уже добавлен.
4. Fallback режим присутствует и используется при отсутствии Supabase runtime.
5. Документы `docs/SUPABASE_SETUP.md` и `docs/ROADMAP.md` уже были в проекте.

## 2) Deployment readiness audit - ключевые выводы
### 2.1 Env inventory и separation
Проверено, что env используется по ролям:
1. Public client vars:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2. Server privileged var:
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Auth strategy vars:
   - `ORKPOD_AUTH_STRATEGY`
   - `ORKPOD_COMMUNITY_WRITE_MODE`
   - `ORKPOD_SUPABASE_ACCESS_TOKEN_COOKIE`
   - `ADMIN_ALLOWED_EMAILS`
   - `ADMIN_ALLOWED_USER_IDS`
4. Safety flags:
   - `ALLOW_BOOTSTRAP_ADMIN_IN_PRODUCTION`
   - `ALLOW_GUEST_COMMUNITY_WRITES_IN_PROD`
   - `ALLOW_FALLBACK_IN_PRODUCTION`
   - `ALLOW_FALLBACK_ON_SUPABASE_ERROR_IN_PRODUCTION`

### 2.2 Найденный риск до правок
До этого прохода был риск, что production runtime может неявно уйти в fallback path при ошибках Supabase (нежелательно для live).

## 3) Что изменено в коде (deployment hardening)
### 3.1 Production/fallback boundary hardening
Добавлен:
1. `src/server/config/runtime-safety.ts`

Обновлен:
1. `src/server/repositories/content-repository.ts`

Изменения:
1. В production при отсутствии Supabase и `ALLOW_FALLBACK_IN_PRODUCTION=false` репозиторий не уходит молча в fallback (fail-fast policy).
2. В production при включенном Supabase по умолчанию отключен silent fallback на Supabase runtime errors (`ALLOW_FALLBACK_ON_SUPABASE_ERROR_IN_PRODUCTION=false`).
3. Локальная/dev совместимость fallback сохранена.

### 3.2 Admin access hardening для production
Обновлен:
1. `src/server/auth/admin-gate.ts`

Изменения:
1. `local_bootstrap` в production теперь блокируется по умолчанию.
2. Разрешение bootstrap в production возможно только через явный флаг `ALLOW_BOOTSTRAP_ADMIN_IN_PRODUCTION=true`.
3. Это снижает риск случайной публикации небезопасного admin режима.

### 3.3 Vercel runtime compatibility guard
Обновлен:
1. `src/app/layout.tsx`

Изменение:
1. Зафиксирован `runtime = "nodejs"` на app-level, чтобы не попасть случайно в edge runtime с несовместимым поведением для server-side контуров.

## 4) Env/config hardening
Обновлен:
1. `.env.example`

Что улучшено:
1. Явное разделение обязательных, стратегических и safety переменных.
2. Добавлены production safety switches с безопасными дефолтами.
3. Убрана двусмысленность «локальные режимы случайно в проде».

## 5) Supabase live path preparation
Проверено/подготовлено:
1. Порядок миграций валиден и задокументирован.
2. RLS/auth ожидания отражены в обновленной документации.
3. Требования к live Supabase (включая `admin_users` и auth cookie flow) описаны явно.

Важно (честно):
1. В этом окружении `supabase db reset` не выполнен (Docker runtime недоступен).
2. Значит runtime-применение миграций/политик локально не подтверждено.
3. Подготовка сделана в migration-ready и docs-ready формате для manual/live шага.

## 6) Vercel live path preparation
Создан:
1. `docs/VERCEL_SETUP.md`

Документ содержит:
1. Практические prerequisites.
2. Список обязательных env vars для Vercel.
3. Runtime caveats.
4. Preflight и post-deploy smoke checks.
5. Риски и rollout порядок.

## 7) Live validation / smoke plan и helper scripts
Добавлены:
1. `scripts/live-smoke-check.ps1`
2. `scripts/check-prod-env.ps1`

Назначение:
1. Быстрая проверка маршрутов на live/base URL.
2. Преддеплойная проверка обязательных production env.

## 8) Обновленные документы
Обновлены/созданы:
1. `docs/SUPABASE_SETUP.md`
2. `docs/VERCEL_SETUP.md`
3. `docs/ROADMAP.md`

## 9) Команды и фактические результаты
Выполнено:
1. `npm run lint` - успешно.
2. `npm run build` - успешно.
3. `supabase --version` - успешно (`2.78.1`).
4. `supabase db reset` - неуспешно (Docker Desktop недоступен).
5. HTTP smoke локально через `npm run start`:
   - при production-safe дефолтах без Supabase env публичные страницы дают fail-fast 500 (ожидаемое защитное поведение).
   - при явном включении fallback-флагов (`ALLOW_FALLBACK_IN_PRODUCTION=true` и `ALLOW_FALLBACK_ON_SUPABASE_ERROR_IN_PRODUCTION=true`) маршруты отвечают 200.
6. `powershell -File scripts/live-smoke-check.ps1 -BaseUrl http://localhost:3120` - успешно (при явно включенном fallback в этой проверке).
7. `powershell -File scripts/check-prod-env.ps1` - ожидаемо показал missing vars в текущем локальном окружении.
8. Дополнительные smoke:
   - `npx tsx scripts/phase07-auth-smoke.ts` - успешно.
   - `npx tsx scripts/phase06-community-smoke.ts` - успешно.

## 10) Production vs fallback boundary (итог)
Явно зафиксировано:
1. Fallback в production теперь не «случайный» и требует явного разрешения флагами.
2. Bootstrap admin mode в production по умолчанию запрещен.
3. Community guest mode в production остаётся под safety switch.
4. Локальная разработка и fallback usability сохранены.

## 11) Что реально выполнено vs что только подготовлено
Реально выполнено:
1. Кодовые hardening-изменения boundary/auth/runtime.
2. Обновление env/config шаблонов.
3. Создание deployment helper scripts.
4. Обновление deployment docs (Supabase + Vercel).
5. Локальные lint/build/smoke проверки.

Только подготовлено (не выполнено в live):
1. Реальный Vercel deploy.
2. Реальное применение миграций/политик в live Supabase.
3. Полный end-to-end live auth/session validation.

## 12) Что осталось для следующего ручного/live шага
1. Выполнить live rollout Vercel + Supabase.
2. Применить миграции в runtime БД и проверить RLS/policies.
3. Настроить и проверить реальный auth/session cookie flow.
4. Прогнать post-deploy checklist и зафиксировать runbook.
