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

