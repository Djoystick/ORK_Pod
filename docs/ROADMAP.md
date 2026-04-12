# ORKPOD Archive Roadmap (после Phase 14A)

## Текущее состояние продукта
1. Публичные маршруты работают: `/`, `/streams`, `/streams/[slug]`, `/about`.
2. Брендинг (green ork, icon, hero background) сохранён.
3. Auth/admin/community flow сохранены без архитектурных изменений.
4. YouTube ingestion + automation phases 11-14 сохранены.
5. Phase 14A закрыл live-блокер `/admin/sources` класса `EROFS` для ingestion lock storage.

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
18. Phase 14A — выполнено (production-safe ingestion lock storage fix для Vercel).

## Что сделано в Phase 14A
1. Найдена и устранена root cause:
   - lock snapshot для ingestion читался/писался только в `data/local-ingestion-locks.json`;
   - на Vercel production это приводило к `EROFS` при рендере `/admin/sources`.
2. Введено явное разделение lock-store стратегии:
   - production (`NODE_ENV=production`) => `memory_ephemeral` (без filesystem writes);
   - local/dev => `file_local_json` (как и раньше);
   - optional local override: `ORKPOD_INGESTION_LOCK_STORE=memory|file`.
3. Locking не удалён и не ослаблен:
   - anti-concurrency guard сохранён;
   - sync-all guard сохранён;
   - rerun safety и dedupe-поведение сохранены.

## Что остаётся до SEO/performance/indexing
1. Подтвердить post-deploy на live, что `/admin/sources` больше не падает по `EROFS`.
2. Продолжить эксплуатационную калибровку API-backed ingestion после подключения production key.
3. После стабилизации масштабного ingestion-контура перейти к SEO/performance/indexing.

## Следующие roadmap-блоки
1. SEO / performance / indexing.
2. Comment reputation system (отдельной фазой, без смешения с ingestion scope).
