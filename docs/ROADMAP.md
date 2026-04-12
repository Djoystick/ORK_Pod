# ORKPOD Archive Roadmap (после Phase 08)

## Видение продукта
ORKPOD развивается в production-ready контент-платформу:
1. Публичный архивный каталог (discoverability-first).
2. Admin CMS + ingestion управление источниками.
3. Community слой (comments/reactions/moderation).
4. Безопасный runtime-контур: auth + RLS + deployment hardening.

## Текущее состояние после Phase 08
1. Публичные маршруты работают:
   - `/`
   - `/streams`
   - `/streams/[slug]`
   - `/about`
2. Работают admin маршруты:
   - `/admin`
   - `/admin/new`
   - `/admin/content`
   - `/admin/content/[id]`
   - `/admin/sources`
   - `/admin/imports`
   - `/admin/imports/[id]`
   - `/admin/moderation`
3. Работают comments/reactions/moderation foundation.
4. Ingestion v1 + hardening v2 сохранены.
5. Auth/RLS foundation из Phase 07 сохранен.
6. Deployment hardening улучшен:
   - production/fallback boundary стал жестче,
   - добавлены production safety switches,
   - подготовлены практичные live setup docs для Supabase и Vercel,
   - добавлены smoke scripts для live-проверок.

## Что уже deployment-ready
1. Пакет migration-ready SQL выстроен по порядку.
2. Auth strategy разделена на dev/fallback и production-oriented path.
3. Production-safe дефолты по fallback/guest/bootstrap flags документированы.
4. Есть практичный post-deploy smoke план и вспомогательные скрипты.

## Что все еще требует manual/live execution
1. Фактическое применение миграций и RLS/policies в live Supabase.
2. Реальная проверка auth/session cookie flow в live окружении.
3. Реальный Vercel deploy и post-deploy functional validation.
4. Операционный runbook с финальной фиксацией мониторинга/алертов.

## Фазы
1. Phase 01 - выполнено: public catalog foundation.
2. Phase 02 - выполнено: Supabase backbone + admin create.
3. Phase 03 - выполнено: admin edit/publish + source registry.
4. Phase 04 - выполнено: YouTube ingestion v1.
5. Phase 05 - выполнено: ingestion hardening v2.
6. Phase 06 - выполнено: comments/reactions/moderation foundation.
7. Phase 07 - выполнено: auth/RLS hardening foundation.
8. Phase 08 - выполнено: deployment hardening + live environment preparation/validation plan.
9. Phase 09 - следующий рекомендованный: live rollout execution + production verification run.
10. Phase 10 - после стабилизации: scheduler/automation infra и UX refinement.

## Обязательные ingestion-источники
1. `orkcut` -> `https://www.youtube.com/@orkcut/videos`
2. `orkstream` -> `https://www.youtube.com/@orkstream/videos`

## Риски и ограничения
1. Без live Supabase runtime применение RLS/policies остается неподтвержденным в рантайме.
2. Без live auth-session интеграции production auth path не может считаться закрытым end-to-end.
3. Включение fallback/guest/bootstrap flags в production повышает риск небезопасного поведения.

## Рекомендация на следующий проход
1. Выполнить реальный Vercel + Supabase live rollout.
2. Прогнать обязательный post-deploy smoke checklist.
3. Зафиксировать runbook, мониторинг и rollback-процедуру.
4. После стабилизации перейти к scheduler/automation infra и точечному UX refinement.
