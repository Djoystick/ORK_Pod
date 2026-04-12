# Phase 13 — real content backfill, calibration и exact-tag path

Дата: 2026-04-12  
Проект: ORKPOD Archive

## 1) Стартовое состояние (фактически перед этим проходом)
1. Phase 11/12 automation уже был внедрён: enrichment, auto-mapping, publish/review rules, safe draft default.
2. Основной ingestion-контур работал через YouTube feed + watch/oEmbed best-effort.
3. Оставались известные ограничения:
   - нет обязательной интеграции YouTube Data API (ключ может отсутствовать);
   - часть source metadata и source tags не exact;
   - calibration правил на реальном более широком наборе не была закреплена;
   - operational debt по rerun/retry для отдельных failure-сценариев.
4. Базовый реальный импорт перед прогоном Phase 13: 30 imported элементов (orkcut 15 + orkstream 15), дубликаты по `externalSourceId` = 0.

## 2) Что сделано в коде

### A. Аудит и readiness
1. Проверены текущие ingestion/review/rerun пути и реальные import runs.
2. Зафиксирован проблемный кейс источника `orkpod-youtube`: невалидный placeholder `externalChannelId` приводил к 404 при резолве канала.

### B. Реальный backfill
1. Добавлен скрипт реального прогона и калибровочной сводки:
   - `scripts/phase13-real-backfill-and-calibration.ts`
   - артефакт: `data/phase13-backfill-summary.json`
2. Скрипт:
   - запускает sync по активным YouTube-источникам в приоритете `orkcut`, `orkstream`, затем остальные;
   - делает dedupe pass (`sync_all`);
   - делает rerun попытки для проблемных runs;
   - сохраняет baseline/after/delta и operational сводки.

### C. Калибровка auto-mapping
1. В mapping добавлены/усилены сигналы:
   - фильтрация low-signal source tags (`video`, `shorts`, `gratis`, `videotelefon`, и т.д.);
   - нормализация source tag сигналов для deterministic matching;
   - explicit учёт exact source tags (`sourceTagsExact`) как сильного сигнала.
2. Усилена explainability:
   - reason codes: `source_tags_exact:true|false`, `semantic_signals:strong|weak`.
3. Снижен риск ложной уверенности:
   - при слабых semantic signals и без exact tags confidence дополнительно ограничивается;
   - uncertain случаи остаются reviewable.

### D. Exact-tag automation path (честно)
1. Добавлен опциональный YouTube Data API слой в enrichment:
   - `YOUTUBE_DATA_API_KEY`
   - `YOUTUBE_DATA_API_TIMEOUT_MS`
2. При доступном API:
   - `title/description/thumbnail/channel/category/tags` читаются из `youtube/v3/videos?part=snippet`;
   - source tags становятся exact (`sourceTagsExact=true`);
   - metadata sources явно включают `youtube_data_api`.
3. Без API ключа:
   - exact source tags недоступны;
   - остаётся best-effort путь (feed + watch + oEmbed), что отражается в payload честно.

### E. Publish/review и admin visibility
1. Publish/review модель из Phase 12 сохранена safe-first (default draft).
2. Для triage добавлен фильтр confidence в admin content list:
   - backend filter (`high|medium|low|no_signals`);
   - UI select в `/admin/content`.

### F. Rerun/retry debt
1. Расширен API `runSourceSync`:
   - `retryExternalSourceIds?: string[]`.
2. `rerunImportRunById`:
   - если есть item-level failed entries, используется `trigger=retry_failed_items` и целевой список `externalSourceId`;
   - иначе fallback в `rerun_source`.
3. В fallback-репозитории retry mode теперь реально фильтрует videos по `retryExternalSourceIds`.
4. Остаточный долг (не скрыт):
   - для source-level failures до item-level детализации rerun остаётся coarse (`rerun_source`).

### G. Fix для source identity и стабильности sync
1. Резолв YouTube-канала усилен:
   - невалидный `externalChannelId` вида `UC-...` больше не используется как handle;
   - приоритет handle из `sourceUrl`, затем безопасные fallback.
2. После успешного sync fallback-source обновляет `externalChannelId` до канонического `UC...`, если старое значение неканонично.

## 3) Результаты реального прогона (Phase 13)
Источник данных: `data/phase13-backfill-summary.json`

1. Baseline imported total: `30`.
2. After imported total: `45`.
3. Delta imported total: `+15` (добавлен `orkpod-youtube`).
4. Dedupe: `duplicatesByExternalSourceId = 0` (до и после).
5. Public-safe: импорт остаётся в `draft` (не раздувает публичную поверхность).
6. Exact tags coverage в этом локальном прогоне: `0/45` (ключ Data API не подключён, ожидаемо).

## 4) Exact vs Best-effort (текущее честное состояние)

### Exact (при наличии YouTube Data API key)
1. `title`
2. `description/body`
3. `thumbnail`
4. `sourceTags` (через snippet.tags)
5. `sourceCategory` (через categoryId)
6. `channel identity` (`channelId`, `channelTitle`)
7. `externalUrl` (детерминированно строится от video id; не эвристика)

### Best-effort (если Data API key отсутствует)
1. `title` — feed/oEmbed.
2. `description/body` — feed/watch-page merge.
3. `thumbnail` — feed/watch/oEmbed.
4. `sourceTags` — feed categories + watch keywords (не exact tags канала/video snippet).
5. `sourceCategory-like` — watch category или feed term.
6. `channel identity` — feed/watch/oEmbed fallback.

## 5) Non-regression и проверки
1. `npm run lint` — успешно.
2. `npm run build` — успешно.
3. `scripts/phase13-real-backfill-and-calibration.ts` — успешно (реальный backfill + summary).
4. `scripts/phase05-ingestion-smoke.ts` — успешно:
   - dedupe стабилен (`duplicateExternalIds: 0`);
   - anti-concurrency lock работает;
   - sync-all guard работает;
   - rerun выполняется без падения.

## 6) Что изменено (файлы)
1. `src/server/services/youtube-ingestion-service.ts`
2. `src/server/repositories/seed-content-repository.ts`
3. `src/server/services/ingestion-job-service.ts`
4. `src/types/repository.ts`
5. `src/server/repositories/supabase-content-repository.ts`
6. `src/server/services/admin-content-service.ts`
7. `src/app/admin/content/page.tsx`
8. `scripts/phase13-real-backfill-and-calibration.ts`
9. `data/phase13-backfill-summary.json`
10. `docs/ROADMAP.md`
11. `docs/reports/phase_13_real_content_backfill_rule_calibration_and_exact_tag_path.md`

## 7) Команды, которые выполнялись
1. `npm run lint`
2. `npm run build`
3. `npx tsx --conditions=react-server scripts/phase13-real-backfill-and-calibration.ts`
4. `npx tsx --conditions=react-server scripts/phase05-ingestion-smoke.ts`
5. Вспомогательные проверки: `git status --short`, `git diff --name-only`, чтение `data/phase13-backfill-summary.json`.

## 8) Что не менялось в этом проходе
1. Не делался SEO/performance/indexing pass.
2. Не внедрялась comment reputation system.
3. Не перерабатывались auth/admin/community архитектурно вне узкого ingestion/automation scope.
4. Не делался редизайн публичного UI.

## 9) Остаточные ограничения и долг на следующий этап
1. Для truly large historical backfill RSS-окна недостаточно; нужен production-путь через официальный YouTube API (playlist/videos pagination).
2. Exact source tags operationally станут массовыми только после подключения Data API key в рабочем окружении.
3. Retry для source-level failures без item-level информации остаётся coarse и требует отдельного углубления.
4. Нужна следующая calibration-итерация на ещё большем реальном корпусе (после включения API path).

## 10) Итог прохода
1. Automation в реальном контуре действительно прогнан и расширен (30 -> 45).
2. Критичный канал-резолв дефект устранён, ingestion стабилизирован.
3. Exact-tag путь реализован практично и честно задокументирован: при ключе — exact, без ключа — best-effort.
4. Safe non-regression соблюдён: build/lint/ingestion smoke успешны, дубликаты не выросли.
