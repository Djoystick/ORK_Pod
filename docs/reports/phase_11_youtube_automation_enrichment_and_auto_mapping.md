# Phase 11 — YouTube automation enrichment + auto-mapping

## 1. Цель прохода
Перевести ingestion-контур из базового импорта в automation-first режим:
1. Улучшить качество source metadata при импорте из YouTube.
2. Добавить детерминированный auto-mapping в доменную модель ORKPOD.
3. Усилить create/update-path так, чтобы ручные правки не перезаписывались вслепую.
4. Дать админу видимость результатов auto-mapping без переработки всей админки.

## 2. Фактический стартовый контекст (до изменений)
1. Рабочие public/auth/admin/community флоу уже присутствовали (Phase 01-10).
2. Ingestion работал через YouTube feed и базовый import loop.
3. Авто-маппинг был минимальным:
   - `category/series` уходили в дефолт,
   - `tagIds` для imported обычно пустые.
4. Защита ручных правок была только для части текстовых полей.
5. В админке не было явной диагностической видимости quality/needs-review по auto-mapping.

## 3. Что реализовано

### 3.1 Metadata enrichment слой YouTube
Файл: `src/server/services/youtube-ingestion-service.ts`

Сделано:
1. Расширен `NormalizedYouTubeVideo`:
   - `sourceTags`
   - `sourceCategory`
   - `sourceChannelId`
   - `sourceChannelTitle`
2. Сохранен feed как основной источник (`videos.xml`), добавлен best-effort watch-page enrichment.
3. В enrichment добавлен разбор:
   - `shortDescription`/meta description,
   - keywords/meta keywords,
   - category (если присутствует),
   - thumbnail hints,
   - channel identity hints.
4. В payload ingestion добавлена диагностика:
   - `metadataSources`,
   - `watchEnriched`,
   - `usedWatchDescription`,
   - `watchEnrichmentError` (если enrichment не удался).

Примечание по честности:
1. Источник метаданных — не официальный YouTube Data API.
2. Используется комбинация feed + watch-page parsing.
3. Наличие source tags/category зависит от того, что реально доступно в странице/мета.

### 3.2 Auto-mapping rules v1
Файл: `src/server/repositories/seed-content-repository.ts`

Сделано:
1. Добавлены deterministic rule-sets для:
   - category
   - series
   - tags
2. Введена оценка качества:
   - `confidence`: `high | medium | low`
   - `needsReview`
   - `fallbackUsed`
3. В `sourcePayload.mapping` теперь пишутся:
   - mapped `category/series/tagIds`
   - confidence/review flags
   - `reasonCodes`
   - `matchedTerms`

### 3.3 Safe create/update automation
Файл: `src/server/repositories/seed-content-repository.ts`

Сделано:
1. New imported items:
   - создаются с enriched metadata + auto-mapped fields;
   - default статус сохранен безопасный: `draft`.
2. Existing imported items:
   - расширен snapshot (`title/slug/text/category/series/tags/publishedAt/primaryUrl`);
   - обновления применяются только если поле не было вручную изменено относительно snapshot;
   - ручные правки сохраняются, auto-sync их не перетирает.
3. Dedupe сохранен:
   - повторный sync не создает дублей по `externalSourceId`;
   - unchanged записи уходят в `skipped_duplicate`.

### 3.4 Admin visibility (операционный минимум)
Файлы:
1. `src/app/admin/content/page.tsx`
2. `src/app/admin/content/[id]/edit-content-form.tsx`

Сделано:
1. В `/admin/content` добавлена колонка `Auto-map`:
   - confidence,
   - review/fallback подсказка,
   - краткая category/series/tags сводка.
2. В `/admin/content/[id]` добавлен блок `Ingestion Auto-mapping` для imported items:
   - confidence/needsReview,
   - mapped category/series/tags count,
   - matched terms preview.

## 4. Поля источника, которые теперь используются
1. `external video URL`
2. `title`
3. `description/body` (feed + watch enrichment)
4. `thumbnail`
5. `publishedAt`
6. `source tags` (best effort)
7. `source category` (best effort)
8. `source channel identity` (id/title)

## 5. Стратегия статусов
1. Для automation import сохранена безопасная стратегия: `draft` по умолчанию.
2. Авто-публикация намеренно не включалась в этом проходе.
3. Это снижает риск массовой ошибочной публикации при неточном маппинге.

## 6. Измененные файлы
1. `src/server/services/youtube-ingestion-service.ts`
2. `src/server/repositories/seed-content-repository.ts`
3. `src/app/admin/content/page.tsx`
4. `src/app/admin/content/[id]/edit-content-form.tsx`
5. `docs/ROADMAP.md`
6. `docs/reports/phase_11_youtube_automation_enrichment_and_auto_mapping.md`

## 7. Команды, выполненные в проходе
1. Аудит:
   - `git status --short`
   - `rg -n ...` по ingestion/repository/admin
   - `Get-Content ...` по ключевым файлам
2. Проверки:
   - `npm run build`
   - `npm run lint`

## 8. Результаты проверок
1. `npm run build` — успешно.
2. `npm run lint` — успешно.
3. Маршруты public/admin в build output присутствуют.

## 9. Что не делалось (осознанно)
1. Не делался широкий редизайн UI.
2. Не добавлялись новые social-фичи.
3. Не переписывался ingestion на отдельный worker/queue/cron стек.
4. Не выполнялась broad SEO/performance фаза.
5. Не менялся Supabase SQL/RLS контур в рамках этого прохода.

## 10. Ограничения и долг следующего этапа
1. Auto-mapping rules пока эвристические и требуют калибровки на большом реальном массиве видео.
2. watch-page enrichment зависит от доступности страницы и стабильности разметки YouTube.
3. Следующий практический шаг:
   - контентный backfill,
   - замер качества маппинга,
   - refine rule-set + приоритизация review-очереди.
