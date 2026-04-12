# Phase 09A — Bugfix: `use server` export invariant (live sign-in 500)

## 1. Цель прохода
Точечно устранить live-блокер:
1. На Vercel `POST /auth/sign-in` падал с ошибкой:
   - `A "use server" file can only export async functions, found object.`
2. Не менять архитектуру и не расширять scope за пределами инварианта export в server-action файлах.

## 2. Фактическая первопричина
В файлах с директивой `"use server"` были экспортированы не-async значения (объекты initial state), например:
1. `src/app/auth/actions.ts`:
   - `export const initialSignInActionState = { ... }`

Это нарушает инвариант Next.js server actions в runtime и вызывает 500 на вызове action.

## 3. Аудит `use server` файлов
Проверены action-модули:
1. `src/app/auth/actions.ts`
2. `src/app/streams/[slug]/community-actions.ts`
3. `src/app/admin/actions.ts`
4. `src/app/admin/new/actions.ts`
5. `src/app/admin/content/[id]/actions.ts`
6. `src/app/admin/moderation/actions.ts`
7. `src/app/admin/sources/actions.ts`
8. `src/app/admin/imports/actions.ts`

Найдено одинаковое нарушение: `export const initial...ActionState`.

## 4. Что исправлено

### 4.1 В `use server` файлах
Удалены не-async экспорты initial state из:
1. `src/app/auth/actions.ts`
2. `src/app/streams/[slug]/community-actions.ts`
3. `src/app/admin/actions.ts`
4. `src/app/admin/new/actions.ts`
5. `src/app/admin/content/[id]/actions.ts`
6. `src/app/admin/moderation/actions.ts`
7. `src/app/admin/sources/actions.ts`
8. `src/app/admin/imports/actions.ts`

После фикса в этих файлах экспортируются только async functions (и type exports).

### 4.2 В клиентских формах/компонентах
Initial state перенесены из server-action модулей в client components:
1. `src/app/auth/sign-in/sign-in-form.tsx`
2. `src/components/community/community-block.tsx`
3. `src/app/admin/bootstrap-published-form.tsx`
4. `src/app/admin/new/manual-content-form.tsx`
5. `src/app/admin/content/[id]/edit-content-form.tsx`
6. `src/app/admin/moderation/comment-moderation-form.tsx`
7. `src/app/admin/sources/source-registry-form.tsx`
8. `src/app/admin/imports/import-run-rerun-form.tsx`

Логика действий не менялась, изменен только способ хранения initial state.

## 5. Команды, выполненные в проходе
1. Аудит:
   - `rg -n "use server" src/app -S`
   - поиск не-async экспортов по action-файлам (`export const ...` в `use server` модулях)
2. Проверка после фикса:
   - `npm run build`
   - `npm run lint`

## 6. Результаты проверки
1. `npm run build` — успешно.
2. `npm run lint` — успешно.
3. Повторная проверка показала отсутствие не-async value exports в `use server` файлах.
4. Маршрут `/auth/sign-in` присутствует в build output.

## 7. Что подтверждено честно, а что нет

### Подтверждено
1. Инвариант экспорта в коде исправлен.
2. Проект собирается и проходит линт после изменений.

### Требует live-подтверждения после деплоя
1. Фактический `POST /auth/sign-in` на Vercel (ожидается отсутствие 500 по этой же причине).

## 8. Обновления документации
1. Обновлен `docs/ROADMAP.md` (зафиксирован Phase 09A и статус bugfix).

