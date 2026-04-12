# ORKPOD Archive Roadmap (после Phase 09)

## Видение продукта
ORKPOD развивается как production-ready контент-платформа:
1. Public archive/catalog с быстрым discoverability-first UX.
2. Admin CMS + source registry + ingestion операции.
3. Community слой (comments/reactions/moderation).
4. Безопасные write-path: Supabase auth + RLS + admin/community gates.

## Текущее состояние после Phase 09
1. Публичные маршруты работают:
   - `/`
   - `/streams`
   - `/streams/[slug]`
   - `/about`
2. Admin маршруты работают:
   - `/admin`
   - `/admin/new`
   - `/admin/content`
   - `/admin/content/[id]`
   - `/admin/sources`
   - `/admin/imports`
   - `/admin/imports/[id]`
   - `/admin/moderation`
3. Community foundation работает:
   - comments/reactions/moderation v1
4. Ingestion работает:
   - YouTube ingestion v1 + hardening v2
5. Auth/RLS foundation сохранен и усилен:
   - видимый sign-in/sign-out UX
   - route `/auth/sign-in`
   - session-aware header
   - admin recognition по `ADMIN_ALLOWED_*` и `admin_users`
6. Добавлен owner-only bootstrap первых published записей через `/admin`.

## Что стало лучше в Phase 09
1. Закрыт live usability gap входа/выхода:
   - кнопки входа/выхода видны в shell.
2. Реальный sign-in flow подключен через Supabase `signInWithPassword`.
3. В header видно состояние пользователя и admin-статус.
4. В community блоках появились прямые entrypoints на вход.
5. Для пустой live БД добавлен безопасный bootstrap published контента.

## Что остается ручным live-долгом
1. Финальный smoke в реальном прод-окружении Vercel/Supabase.
2. Проверка фактических RLS/policy эффектов на live данных.
3. Операционные runbooks/rollback мониторинг.
4. Проверка длительных auth-session сценариев (реавторизация/refresh поведение).

## Фазы
1. Phase 01 - выполнено: public catalog foundation.
2. Phase 02 - выполнено: Supabase backbone + admin create.
3. Phase 03 - выполнено: admin edit/publish + source registry.
4. Phase 04 - выполнено: YouTube ingestion v1.
5. Phase 05 - выполнено: ingestion hardening v2.
6. Phase 06 - выполнено: comments/reactions/moderation foundation.
7. Phase 07 - выполнено: auth/RLS hardening foundation.
8. Phase 08 - выполнено: deployment hardening + live preparation.
9. Phase 09 - выполнено: live auth UI/session flow + admin recognition UX + first content bootstrap.
10. Phase 10 - рекомендуемый следующий: production rollout validation и post-live stabilization.

## Обязательные ingestion-источники
1. `orkcut` -> `https://www.youtube.com/@orkcut/videos`
2. `orkstream` -> `https://www.youtube.com/@orkstream/videos`

## Риски и ограничения
1. Без live smoke нельзя считать релиз полностью подтвержденным.
2. Без строгой дисциплины по safety flags есть риск случайного включения dev/fallback поведения в production.
3. Auth/session реализован практически, но требует реального мониторинга после live rollout.

## Рекомендация на следующий проход
1. Выполнить фактический live smoke по чеклисту из `docs/VERCEL_SETUP.md`.
2. Подтвердить сценарии:
   - sign-in/sign-out
   - admin allowlist/admin_users recognition
   - comments/reactions write behavior
   - moderation actions
3. Зафиксировать результаты в operational runbook.
4. После стабилизации перейти к scheduler automation и точечному UX refinement.

