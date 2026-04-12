# ORKPOD Archive Roadmap (после Phase 14)

## Текущее состояние продукта
1. Публичные маршруты работают: `/`, `/streams`, `/streams/[slug]`, `/about`.
2. Брендинг Phase 10 (green ork, icon, hero background) сохранён.
3. Auth/sign-in/sign-out, admin CMS, source registry, community flow сохранены.
4. Ingestion pipeline и automation rules работают в live-safe режиме (draft/review default).
5. Phase 14 усилил production-ready API-backed path для YouTube metadata и historical backfill стратегии.

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
17. Phase 14 — выполнено (YouTube Data API enablement + large backfill path prep + operator visibility).

## Что усилено в Phase 14
1. Data API путь стал primary при наличии ключа:
   - добавлен primary ingestion path через `channels -> uploads playlist -> playlistItems pagination -> videos snippet`;
   - RSS path сохранён как честный fallback.
2. Поддержан исторический backfill beyond RSS-window:
   - pagination по uploads playlist;
   - env-контроли `YOUTUBE_DATA_API_BACKFILL_MAX_ITEMS_PER_SOURCE` и `YOUTUBE_DATA_API_BACKFILL_PAGE_SIZE`.
3. Уточнена операционная телеметрия ingestion:
   - `dataAcquisitionPath` (`youtube_data_api_primary` / `youtube_feed_fallback`);
   - API-backed/exact сигналы и backfill telemetry в payload.
4. Улучшена админ-видимость:
   - `/admin/content` фильтр `metadataMode` (`exact_api`, `api_backed`, `best_effort`);
   - `/admin/imports` агрегаты imported/API-backed/exact/best-effort/review-needed.
5. Сохранены safety guarantees:
   - dedupe не создаёт duplicate external IDs;
   - ручные правки не перезаписываются вслепую;
   - rerun/retry и lock-guard остаются рабочими.

## Что остаётся до SEO/performance/indexing
1. Подключить реальный `YOUTUBE_DATA_API_KEY` в production окружении (без него API-backed exact path не активируется на данных).
2. Провести крупный historical backfill уже с ключом и откалибровать mapping/rules на расширенном корпусе.
3. При необходимости углубить ingestion observability для long-run backfill операций.

## Следующие roadmap-блоки
1. SEO / performance / indexing (после закрепления API-backed масштабного backfill).
2. Comment reputation system (отдельной фазой, без смешения с ingestion scope).
