# Phase 09C — Live community write: fix rate-limit storage + identity/UI alignment

## 1. Цель прохода
Устранить production-блокер comments/reactions на live detail-страницах, где community write падал из-за записи в локальный файловый rate-limit store (`/var/task` на Vercel read-only), и выровнять UI с режимом `ORKPOD_COMMUNITY_WRITE_MODE=supabase_auth_required`.

## 2. Фактический стартовый контекст
1. Live auth/sign-in/sign-out и admin recognition уже работали.
2. Public archive/detail и bootstrap published content были доступны.
3. Live community writes (comments/reactions) падали с:
   - `EROFS: read-only file system, open '/var/task/data/local-write-rate-limits.json'`.
4. В public community UI продолжал показываться guest-ввод имени, что конфликтовало с auth-required production режимом.

## 3. Точная первопричина
1. `src/app/streams/[slug]/community-actions.ts` всегда вызывал `consumeWriteRateLimit(...)`.
2. `src/server/security/write-rate-limit.ts` использовал только файловый backend (`data/local-write-rate-limits.json`) через `fs/promises`.
3. В Vercel production runtime файловая запись в `/var/task` запрещена (read-only), что приводило к `EROFS`.
4. UI в `src/components/community/community-block.tsx` всегда показывал guest identity input, даже при `supabase_auth_required`.

## 4. Что изменено

### 4.1 Production-safe стратегия rate-limit storage
Обновлен файл:
1. `src/server/security/write-rate-limit.ts`

Изменения:
1. Введены два режима хранилища:
   - `memory_ephemeral` (in-memory, без записи в файловую систему),
   - `file_local_json` (локальный JSON файл для dev/fallback).
2. В production (`NODE_ENV=production`) режим принудительно `memory_ephemeral`.
3. В local/dev по умолчанию сохранен `file_local_json`.
4. Добавлен опциональный dev override: `ORKPOD_RATE_LIMIT_STORE` (`memory` / `file` / `file_local_json`).
5. В production write-path больше не доходит до `writeFile(...)`.

### 4.2 Identity path для auth-required community write
Обновлен файл:
1. `src/server/auth/community-identity.ts`

Изменения:
1. Добавлен `buildSupabaseActorFingerprint(userId)` для стабильной actor identity в auth-required режиме.
2. Добавлен `resolveCommunityIdentityForWrite({ writeContext, preferredDisplayName })`:
   - если write требует auth и есть Supabase principal, identity строится из auth-контекста,
   - guest-cookie identity используется только в guest/fallback режиме.

### 4.3 Server actions выровнены под auth-required identity
Обновлен файл:
1. `src/app/streams/[slug]/community-actions.ts`

Изменения:
1. `ensureCommunityIdentity(...)` заменен на `resolveCommunityIdentityForWrite(...)`.
2. Комментарии/реакции в auth-required режиме используют auth-aware fingerprint, а не fallback guest-cookie путь.

### 4.4 Корректное сопоставление viewer reaction в auth-required режиме
Обновлен файл:
1. `src/server/services/community-service.ts`

Изменения:
1. Для `supabase_auth_required` viewer fingerprint рассчитывается от Supabase user id.
2. Reaction summary сопоставляется с этим fingerprint, чтобы корректно отмечать реакцию текущего авторизованного пользователя.

### 4.5 UI/mode alignment на detail-странице
Обновлены файлы:
1. `src/components/community/community-block.tsx`
2. `src/app/streams/[slug]/page.tsx`

Изменения:
1. В props community блока добавлен `writeMode`.
2. В `supabase_auth_required` скрыто поле guest имени; показывается auth-aware сообщение.
3. Для неавторизованного пользователя в auth-required режиме сохранено понятное требование входа.
4. Для guest/fallback режима поле имени сохранено.

### 4.6 Env documentation
Обновлен файл:
1. `.env.example`

Изменения:
1. Добавлена документация `ORKPOD_RATE_LIMIT_STORE` как optional dev override.
2. Явно указано, что в production runtime rate-limit storage принудительно in-memory.

## 5. Граница production vs fallback после фикса
1. Production:
   - community rate-limit хранится в memory,
   - нет попыток записи в local filesystem,
   - auth-required mode использует Supabase-auth identity path.
2. Local/dev fallback:
   - может использовать file-based rate-limit store,
   - guest identity сценарий сохранен для локальной разработки.

## 6. Команды, выполненные в проходе
1. Аудит:
   - `rg -n "local-write-rate-limits|rate.?limit|community_write|ORKPOD_COMMUNITY_WRITE_MODE|supabase_auth_required|guest" src`
   - `Get-Content ...` по community/auth/security/service файлам.
2. Проверки после изменений:
   - `npm run build`
   - `npm run lint`

## 7. Результаты проверки
1. `npm run build` — успешно.
2. `npm run lint` — успешно.
3. По коду production path `consumeWriteRateLimit(...)` в `NODE_ENV=production` не использует file store.
4. Community UI на detail-странице больше не показывает guest identity input в auth-required режиме.

## 8. Что подтверждено и что требует live-подтверждения

### Подтверждено локально
1. Кодовый путь, приводивший к `EROFS`, устранен (production store mode теперь in-memory).
2. Сборка/линт проходят.
3. UI-mode alignment реализован.

### Требует post-deploy подтверждения
1. Проверка live detail write flow после деплоя:
   - sign-in,
   - отправка комментария,
   - установка реакции,
   - отсутствие `EROFS` в Vercel logs.
2. Проверка пользовательского UX для неавторизованного сценария в auth-required режиме.

## 9. Что не менялось в рамках этого прохода
1. Не менялись Supabase policies/RLS.
2. Не менялась архитектура ingestion/admin.
3. Не добавлялись новые social features.
4. Не делался visual redesign.
