# ORKPOD Archive Roadmap (после Phase 09A)

## Текущее состояние
1. Публичные маршруты работают: `/`, `/streams`, `/streams/[slug]`, `/about`.
2. Admin CMS, source registry, imports, moderation и fallback режим сохранены.
3. Ingestion (v1 + hardening v2), comments/reactions/moderation foundation и auth/RLS foundation сохранены.
4. Live auth UX из Phase 09 сохранен: visible sign-in/sign-out и `/auth/sign-in`.

## Что завершено в Phase 09A
1. Исправлен блокирующий runtime-баг Next.js server actions:
   - устранены не-async экспорты из файлов с `"use server"`.
2. Устранена причина live-ошибки `A "use server" file can only export async functions, found object`.
3. Паттерн выровнен для всех текущих action-модулей в `src/app/**/actions.ts`.

## Статус фаз
1. Phase 01 — выполнено: public catalog foundation.
2. Phase 02 — выполнено: Supabase backbone + admin create.
3. Phase 03 — выполнено: admin edit/publish + source registry.
4. Phase 04 — выполнено: YouTube ingestion v1.
5. Phase 05 — выполнено: ingestion job hardening v2.
6. Phase 06 — выполнено: comments/reactions/moderation foundation.
7. Phase 07 — выполнено: auth/RLS hardening foundation.
8. Phase 08 — выполнено: deployment hardening + live preparation.
9. Phase 09 — выполнено: live auth UI/session + admin recognition + first content bootstrap.
10. Phase 09A — выполнено: bugfix `use server` export invariant для live sign-in POST.

## Что еще требует live-подтверждения
1. Пост-деплой проверка `/auth/sign-in` POST на Vercel после выката fix.
2. Подтверждение admin/community write-path поведения в реальном окружении.

## Следующий рекомендуемый шаг
1. Выполнить короткий post-deploy smoke:
   - открыть `/auth/sign-in`,
   - выполнить вход,
   - убедиться, что POST больше не возвращает 500 по export invariant.

## Что завершено в Phase 09B
1. Устранен production-crash /admin, вызванный ожидаемым исключением ingestion runtime в Supabase-репозитории.
2. Для ingestion-блоков админки добавлена graceful degradation вместо фатального 500:
   - /admin
   - /admin/sources
   - /admin/imports
   - /admin/imports/[id]
3. Fail-fast модель сохранена для нецелевых ошибок: перехватывается только известный runtime-limit ingestion-path.

## Статус после Phase 09B
1. Public-маршруты и admin-shell остаются рабочими.
2. Ограничения ingestion runtime теперь отображаются как warning-состояние, а не авария страницы.
3. Для подтверждения в production требуется post-deploy smoke на Vercel (проверка /admin и связанных импорт-разделов).

## Следующий рекомендуемый шаг
1. Выполнить post-deploy smoke:
   - открыть /admin, /admin/sources, /admin/imports, /admin/imports/{id};
   - убедиться, что при неактивном ingestion runtime отображается warning/ограниченный режим без 500;
   - убедиться, что остальные admin-блоки продолжают работать штатно.

## Что завершено в Phase 09C
1. Устранен live-блокер community write в production: путь rate-limit больше не пишет в локальный файловый store на Vercel.
2. В `src/server/security/write-rate-limit.ts` внедрена явная стратегия:
   - production (`NODE_ENV=production`) => `memory_ephemeral` (без `fs`-записей),
   - local/dev => `file_local_json` (сохранен fallback-режим),
   - опциональный dev override через `ORKPOD_RATE_LIMIT_STORE`.
3. Community identity/write flow выровнен под `supabase_auth_required`:
   - server actions используют `resolveCommunityIdentityForWrite(...)`,
   - в auth-required режиме формируется стабильный fingerprint от Supabase user id без guest-cookie зависимости для write-path.
4. Public detail community UI выровнен по режиму:
   - в `supabase_auth_required` скрыто guest-поле имени,
   - показаны корректные auth-aware сообщения,
   - в guest/fallback режиме поле имени сохранено.
5. Реакции для авторизованного пользователя корректнее сопоставляются с текущим viewer fingerprint в auth-required режиме.

## Статус после Phase 09C
1. Community write-path в production больше не зависит от записи в локальную файловую систему.
2. UI detail-страницы больше не показывает ввод guest identity в auth-required режиме.
3. Локальный fallback-сценарий сохранен и явно отделен от production поведения.

## Следующий рекомендуемый шаг
1. Выполнить post-deploy smoke на live:
   - открыть detail-страницу,
   - проверить sign-in и отправку комментария/реакции,
   - убедиться в отсутствии `EROFS` и успешной server action обработке,
   - проверить, что для неавторизованного пользователя в auth-required режиме показывается корректное требование входа.

## Что завершено в Phase 10
1. Выполнен узкий брендовый проход без изменения бизнес-логики и backend-контуров.
2. Добавлены и подключены локальные ассеты:
   - `public/branding/icon.jpg`
   - `public/branding/background.webp`
3. `icon.jpg` интегрирован в бренд-шапку (header brand mark) и в metadata icons (`src/app/layout.tsx`).
4. `background.webp` применен строго к главному hero-блоку на домашней странице (`src/app/page.tsx`) с контрастными overlay для читаемости.
5. Визуальный язык смещен в зеленую ork-тему при сохранении dark-dominant базы:
   - основные CTA-кнопки,
   - активные пункты навигации,
   - фокус-состояния полей,
   - ключевые ссылки/чипы на публичных страницах,
   - фоновые glow-акценты shell.

## Статус после Phase 10
1. Публичные страницы, auth, admin, archive/detail, community и moderation-потоки сохранены рабочими.
2. Брендинг стал визуально целостным: зеленая акцентная система + локальный icon + hero background.
3. Проход остается узким: auth/admin/community/ingestion/Supabase-логика не перерабатывались.

## Следующий рекомендуемый шаг
1. Вернуться к следующему roadmap-приоритету после визуального прохода:
   - эксплуатационное улучшение ingestion/automation или
   - deployment/runtime hardening, в зависимости от текущего операционного риска.

