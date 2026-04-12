# Phase 14 — YouTube Data API enablement и large historical backfill path

Дата: 2026-04-12  
Проект: ORKPOD Archive

## 1) Стартовое состояние (фактически до этого прохода)
1. Phase 13 подтвердил рабочий automation-контур и реальный backfill (`30 -> 45`), но:
   - YouTube Data API был только дополнительным enrichment-слоем поверх RSS-окна;
   - exact source tags зависели от наличия `YOUTUBE_DATA_API_KEY`;
   - исторический масштабный backfill beyond RSS-window не был реализован как primary path.
2. По данным локального прогона до правок Phase 14:
   - imported total: `45`;
   - duplicate external IDs: `0`;
   - exact tags coverage: `0/45` (ключ API не был задан).

## 2) Что изменено в Phase 14

### A. Аудит API-ready состояния
1. Проверен текущий ingestion path в `youtube-ingestion-service` и связанные admin/ops поверхности.
2. Подтверждено, что Data API до этого использовался только для enrichment уже полученных из RSS видео.

### B. Усиление YouTube Data API path
1. Реализован primary Data API ingestion path при наличии ключа:
   - `channels.list` для получения uploads playlist;
   - `playlistItems.list` с пагинацией для historical выборки;
   - `videos.list(part=snippet)` для точных metadata сигналов.
2. Добавлена нормализация видео напрямую из Data API в `NormalizedYouTubeVideo`.
3. Усилена честная телеметрия ingestion:
   - `dataAcquisitionPath` (`youtube_data_api_primary` / `youtube_feed_fallback`);
   - `dataApiPrimaryPathAttempted`, `dataApiPrimaryPathUsed`, `dataApiPrimaryPathError`;
   - backfill telemetry (`requested/collected/pages/hasMore/nextPageToken/uploadsPlaylistId`).
4. RSS path сохранён как fallback, если:
   - API key отсутствует;
   - API primary path вернул ошибку/пустой результат.

### C. Large historical backfill path
1. Добавлен масштабируемый historical path через uploads playlist pagination.
2. Добавлены env-контроли:
   - `YOUTUBE_DATA_API_PREFER_PRIMARY`
   - `YOUTUBE_DATA_API_BACKFILL_MAX_ITEMS_PER_SOURCE`
   - `YOUTUBE_DATA_API_BACKFILL_PAGE_SIZE`
3. Ограничения и защита:
   - hard-cap на размер выборки;
   - dedupe и safe draft/review defaults сохранены.

### D. Admin / operator visibility
1. `/admin/content`:
   - добавлен фильтр `metadataMode` (`exact_api`, `api_backed`, `best_effort`, `no_signals`);
   - в карточке auto-map добавлены метки metadata mode и acquisition path.
2. `/admin/content/[id]`:
   - расширен блок ingestion auto-mapping: `api_backed/best_effort`, `exact_tags`, metadata sources, acquisition path.
3. `/admin/imports`:
   - добавлены агрегаты:
     - Imported Total
     - API-backed
     - Exact Tags
     - Best-effort
     - Review Needed

### E. Config / env readiness
1. `.env.example` обновлён для production-ready API path:
   - `YOUTUBE_DATA_API_KEY`
   - `YOUTUBE_DATA_API_TIMEOUT_MS`
   - `YOUTUBE_DATA_API_PREFER_PRIMARY`
   - `YOUTUBE_DATA_API_BACKFILL_MAX_ITEMS_PER_SOURCE`
   - `YOUTUBE_DATA_API_BACKFILL_PAGE_SIZE`
2. Отдельно добавлен Phase 14 audit/backfill script:
   - `scripts/phase14-youtube-data-api-enablement-audit.ts`
   - артефакт: `data/phase14-api-backfill-summary.json`

## 3) Что теперь API-backed exact, а что fallback

### API-backed (когда задан реальный `YOUTUBE_DATA_API_KEY`)
1. `title` (videos snippet)
2. `description/body` (videos snippet)
3. `thumbnail` (videos snippet thumbnails)
4. `source tags` (videos snippet tags, exact)
5. `source category-like signal` (videos snippet categoryId)
6. `channel identity` (`channelId`, `channelTitle`)
7. `canonical external URL` (`https://www.youtube.com/watch?v=<id>`)
8. Историческая выборка beyond RSS-window через uploads playlist pagination

### Fallback / best-effort (когда ключ отсутствует или API path не сработал)
1. RSS feed (`videos.xml`) как источник списка видео.
2. watch page + oEmbed enrichment как best-effort.
3. source tags остаются не exact, пока нет API snippet tags.

## 4) Результаты фактических прогонов в этом проходе
Источник: `data/phase14-api-backfill-summary.json`

1. `apiKeyConfigured: false` (в локальном прогоне реальный ключ не подключён).
2. Baseline:
   - imported total: `45`
   - acquisition path: `unknown` (до обновления telemetry полей у старых записей)
3. После прогона с обновлённой telemetry:
   - imported total: `45`
   - acquisition path: `youtube_feed_fallback: 45`
   - API-backed: `0`
   - exact tags: `0`
   - duplicates: `0`
4. Это ожидаемо и честно: код готов к API-backed exact path, но в текущем окружении он не активирован из-за отсутствия ключа.

## 5) Safe non-regression
1. `npm run lint` — успешно.
2. `npm run build` — успешно.
3. `scripts/phase14-youtube-data-api-enablement-audit.ts` — успешно.
4. `scripts/phase05-ingestion-smoke.ts` — успешно:
   - dedupe не создаёт duplicate external IDs;
   - lock/anti-concurrency guard рабочий;
   - sync-all guard рабочий;
   - rerun path рабочий.

## 6) Файлы, изменённые в Phase 14
1. `.env.example`
2. `src/server/services/youtube-ingestion-service.ts`
3. `src/server/repositories/seed-content-repository.ts`
4. `src/server/services/admin-content-service.ts`
5. `src/app/admin/content/page.tsx`
6. `src/app/admin/content/[id]/edit-content-form.tsx`
7. `src/server/services/admin-source-service.ts`
8. `src/app/admin/imports/page.tsx`
9. `scripts/phase14-youtube-data-api-enablement-audit.ts`
10. `data/phase14-api-backfill-summary.json`
11. `docs/ROADMAP.md`
12. `docs/reports/phase_14_youtube_data_api_enablement_and_large_backfill_path.md`

## 7) Команды, выполненные в этом проходе
1. `npm run lint`
2. `npm run build`
3. `npx tsx --conditions=react-server scripts/phase14-youtube-data-api-enablement-audit.ts`
4. `npx tsx --conditions=react-server scripts/phase05-ingestion-smoke.ts`
5. Вспомогательные команды аудита: `rg`, `Get-Content`, `git status --short`, `git diff`.

## 8) Что остаётся на следующий этап
1. Подключить реальный `YOUTUBE_DATA_API_KEY` в production env.
2. Выполнить крупный historical backfill уже в API-primary режиме.
3. Повторно откалибровать mapping/rules на расширенном API-backed корпусе (особенно exact tags).
4. После закрепления масштабного ingestion-пути переходить к SEO/performance/indexing.

## 9) Итог
1. API-backed path стал production-usable на уровне кода и конфигурации.
2. Large historical backfill стратегия реализована практично (uploads playlist pagination), а не только описана.
3. Fallback-поведение осталось честным и безопасным при отсутствии ключа.
4. Live-safe контуры (public/auth/admin/community/ingestion safety) не сломаны.
