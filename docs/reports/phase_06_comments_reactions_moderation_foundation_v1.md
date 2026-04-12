# Phase 06 - Comments / Reactions / Moderation Foundation v1

Дата: 2026-04-11  
Проект: ORKPOD Archive  
Фаза: 06  
Статус: выполнено (с учетом ограничений локального окружения Supabase runtime)

## 1) Стартовое состояние (аудит после Phase 05)
Подтверждено на старте:
1. Публичные маршруты работают: `/`, `/streams`, `/streams/[slug]`, `/about`.
2. Архивный UX (поиск/фильтры/сортировка) сохранен.
3. Работают admin CMS и ingestion-флоу:
   - `/admin`, `/admin/new`, `/admin/content`, `/admin/content/[id]`
   - `/admin/sources`, `/admin/imports`, `/admin/imports/[id]`
4. Repository/service слой и fallback режим присутствуют.
5. Ingestion v2 hardening из Phase 05 сохранен.

## 2) Что реализовано в этой фазе
Реализован первый practical community layer:
1. Комментарии на detail-странице стрима.
2. Реакции на detail-странице (toggle/replace логика).
3. Moderation-ready поведение комментариев.
4. Админ-поверхность модерации `/admin/moderation`.
5. Расширение repository/data-access контракта для community.
6. Fallback persistence для comments/reactions без удаления существующего fallback режима.

## 3) Доменная модель и schema foundation
### 3.1 Изменения типов
Обновлен `src/types/content.ts`:
1. Добавлен `CommunityIdentityMode = guest_cookie_v1`.
2. Расширен `CommentRecord`:
   - `identityMode`
   - `authorFingerprint`
   - `moderationReason`
3. Добавлены сущности для reactions summary и команд:
   - `ReactionSummaryItem`
   - `CommunityReactionSummary`
   - `CreateCommentInput`
   - `UpdateCommentModerationInput`
   - `UpsertReactionInput`
   - `UpsertReactionResult`

### 3.2 Изменения migration-ready SQL
Добавлена миграция:
1. `supabase/migrations/20260411234500_phase_06_community_foundation_v1.sql`

Что добавлено в SQL:
1. `comments.identity_mode` (default `guest_cookie_v1` + check constraint).
2. `comments.author_fingerprint`.
3. Индексы для comments/reactions под community read/write path.

Важно: миграция создана, но локально не применена (см. раздел про Supabase runtime).

## 4) Repository / data-access расширение
Обновлен контракт `ContentRepository` (`src/types/repository.ts`) и реализации:
1. `listCommentsForContentItem`
2. `createComment`
3. `setCommentModeration`
4. `listModerationComments`
5. `listReactionsForContentItem`
6. `upsertReaction`

Измененные репозитории:
1. `src/server/repositories/content-repository.ts` (fallback wrapper для новых методов).
2. `src/server/repositories/seed-content-repository.ts` (полная fallback-реализация comments/reactions/moderation).
3. `src/server/repositories/supabase-content-repository.ts` (Supabase path для community-методов).

## 5) Fallback storage для community
Обновлен `src/server/storage/local-fallback-store.ts`:
1. Добавлены локальные хранилища:
   - `data/local-comments.json`
   - `data/local-reactions.json`
2. Добавлены read/write функции для обоих store.

Обновлен `.gitignore`:
1. `data/local-comments.json`
2. `data/local-reactions.json`

## 6) Public community UI v1
### 6.1 Детальная страница стрима
Изменен:
1. `src/app/streams/[slug]/page.tsx`

Добавлено:
1. Community блок на detail-странице:
   - список видимых комментариев,
   - блок реакций с counts и действиями,
   - форма добавления комментария,
   - пустые состояния и честное пояснение moderation/identity.

### 6.2 Новые community-компоненты/экшены
Добавлены:
1. `src/components/community/community-block.tsx`
2. `src/app/streams/[slug]/community-actions.ts`
3. `src/server/auth/community-identity.ts`
4. `src/server/services/community-service.ts`

## 7) Временная identity/auth модель (честная)
Выбрана и реализована модель:
1. `guest_cookie_v1` (временная).
2. Идентификатор посетителя хранится в cookie (`orkpod_guest_id`).
3. Отображаемое имя хранится в cookie (`orkpod_guest_name`) и может изменяться пользователем.
4. Это явно не production-auth и не заменяет будущий auth/RLS hardening.

## 8) Правила comments/reactions/moderation
### 8.1 Комментарии
1. Базовая валидация:
   - имя 2..48 символов,
   - комментарий 3..1200 символов,
   - ограничение по количеству ссылок.
2. Базовая abuse-защита:
   - антиспам cooldown для быстрых повторных отправок одним fingerprint.
3. Default moderation strategy:
   - новый комментарий создается в `pending`,
   - публично показываются только `approved`,
   - `hidden/rejected` не выдаются в public detail.

### 8.2 Реакции
1. Реакции привязаны к временной identity (`actorFingerprint`).
2. Повторный клик по той же реакции снимает ее (`removed`).
3. Выбор другой реакции заменяет предыдущую реакцию пользователя (`updated`).
4. Бесконечные дубликаты одной реакции для одного пользователя/контента не создаются (логика upsert/toggle/replace).

## 9) Admin moderation UI v1
Добавлен новый маршрут:
1. `/admin/moderation`

Функциональность:
1. Листинг комментариев с привязкой к контенту.
2. Фильтры по статусу и поиску.
3. Действия модерации:
   - `approve`
   - `hide`
   - `reject`
4. Переход к публичной detail-странице записи из строки модерации.

Связанные файлы:
1. `src/app/admin/moderation/page.tsx`
2. `src/app/admin/moderation/actions.ts`
3. `src/app/admin/moderation/comment-moderation-form.tsx`
4. `src/app/admin/layout.tsx` (добавлена навигация)
5. `src/app/admin/page.tsx` (добавлена карточка moderation в overview)

## 10) Обновление roadmap и setup-доков
1. Обновлен `docs/ROADMAP.md` под состояние после Phase 06.
2. Обновлен `docs/SUPABASE_SETUP.md`:
   - зафиксированы community fallback stores,
   - явно описано временное состояние identity/auth.

## 11) Команды и проверки
Выполненные команды:
1. `npm run lint` - успешно.
2. `npm run build` - успешно.
3. `supabase --version` - успешно (`2.78.1`).
4. `supabase db reset` - неуспешно (Docker Desktop недоступен, `docker_engine` pipe not found).
5. `NODE_OPTIONS=--conditions=react-server npx tsx scripts/phase06-community-smoke.ts` - успешно.
6. HTTP smoke через `npm run start -- --port 3111` + `Invoke-WebRequest` - успешно:
   - `/`
   - `/streams`
   - `/about`
   - `/streams/inside-stream-editorial-pipeline`
   - `/admin`
   - `/admin/content`
   - `/admin/sources`
   - `/admin/imports`
   - `/admin/moderation`

## 12) Результаты smoke-проверок community
Проверено скриптом `scripts/phase06-community-smoke.ts`:
1. `pending` комментарий не попадает в публичную выдачу.
2. После `approved` комментарий становится публично видимым.
3. После `hidden` комментарий снова не виден публично.
4. Реакции работают консистентно:
   - `created` -> `removed` -> `created` -> `updated`
   - в итоге у одного actor на item остается 1 реакция.

## 13) Что не сделано в этой фазе (осознанно)
1. Не внедрен финальный production auth/RLS.
2. Не внедрена полноценная social-система (threading, профили, расширенный антиспам).
3. Не внедрена финальная deployment-инфраструктура.
4. Не выполнялся большой визуальный редизайн.
5. Не переписывался ingestion-движок вне необходимой интеграции.

## 14) Ограничения и оставшийся долг
1. Временная identity-модель `guest_cookie_v1` не является production-safe auth.
2. Supabase migration runtime application не подтверждено локально из-за отсутствующего Docker.
3. Для production нужны отдельные этапы:
   - auth/RLS hardening,
   - policy-level anti-abuse/rate-limits,
   - deployment hardening.

## 15) Рекомендация на следующий проход
1. Приоритетно выполнить auth/RLS hardening для production-safe write путей (включая community и admin).
2. После этого перейти к deployment hardening (Vercel/Supabase live setup, monitoring, runbooks).
3. Далее развивать community UX (без раздувания scope) и automation infra ingestion по плану roadmap.
