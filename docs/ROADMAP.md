# ORKPOD Archive Roadmap (после Phase 14B)

## Текущее состояние продукта
1. Публичные маршруты работают: `/`, `/streams`, `/streams/[slug]`, `/about`.
2. Брендинг (green ork, icon, hero background) сохранён.
3. Auth/admin/community flow остаются рабочими без изменений архитектуры.
4. Фазы 11-14 по automation (enrichment, auto-mapping, publish/review rules, API-backed path) сохранены.
5. Phase 14A закрыл production-блокер EROFS для ingestion locks.
6. Phase 14B включил runtime parity: Supabase ingestion path больше не заглушка и выполняет реальные sync/import runs через production-ветку репозитория.

## Статус фаз
1. Phase 01 — выполнено.
2. Phase 02 — выполнено.
3. Phase 03 — выполнено.
4. Phase 04 — выполнено.
5. Phase 05 — выполнено.
6. Phase 06 — выполнено.
7. Phase 07 — выполнено.
8. Phase 08 — выполнено.
9. Phase 09 — выполнено.
10. Phase 09A — выполнено.
11. Phase 09B — выполнено.
12. Phase 09C — выполнено.
13. Phase 10 — выполнено.
14. Phase 11 — выполнено.
15. Phase 12 — выполнено.
16. Phase 13 — выполнено.
17. Phase 14 — выполнено.
18. Phase 14A — выполнено.
19. Phase 14B — выполнено (live ingestion runtime parity + API-primary activation path).

## Что сделано в Phase 14B
1. Найден и устранён root cause fallback-warning на `/admin/sources`: в `SupabaseContentRepository` ingestion-методы были заглушками и всегда бросали “runtime not active”.
2. Реализован рабочий Supabase ingestion runtime path:
   - `runSourceSync`
   - `runAllActiveSourceSync`
   - `getImportRunById`
   - `listImportRuns`
3. Включено сохранение telemetry в `import_runs` и `import_run_items` без fallback-by-default.
4. Сохранены safety-гарантии:
   - dedupe по `external_source_id`
   - anti-concurrency/sync-all guards (через существующий lock/job слой)
   - rerun/retry_failed_items логика
   - safe draft/review defaults
   - защита manual edits через ingestion snapshot/override checks

## Что остаётся перед SEO/performance/indexing
1. Подтвердить post-deploy на live, что `/admin/sources` больше не показывает runtime fallback warning в штатной production-конфигурации.
2. Подтвердить на live end-to-end source sync с реальным `YOUTUBE_DATA_API_KEY` и проверить telemetry (`/admin/imports`, `/admin/content`).
3. После стабилизации ingestion-контура переходить к SEO/performance/indexing.

## Следующие roadmap-блоки
1. SEO / performance / indexing.
2. Comment reputation system.
3. При необходимости: углубление automation infra для масштабного backfill/операций.
