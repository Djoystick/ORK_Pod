# Phase 12 — Надежные YouTube metadata + publish/review rules

## 1. Цель прохода
Усилить automation ingestion после Phase 11 без слома live-функциональности:
1. Повысить надежность metadata acquisition.
2. Улучшить auto-mapping и explainability.
3. Ввести явные и проверяемые publish/review decision rules.
4. Улучшить admin-видимость review-очереди.

## 2. Фактическое стартовое состояние (до изменений)
1. Ingestion работал через `feed` + best-effort watch-page enrichment.
2. Auto-mapping был эвристическим и уже имел `confidence/needsReview`, но policy-layer publish/review была неявной.
3. Default статус для импортов был безопасный `draft`.
4. Create/update safety уже присутствовал (dedupe + snapshot/manual-override защита).
5. Реальный ingestion runtime в текущей фазе продолжает работать через fallback-репозиторий (Supabase ingestion path по-прежнему не активирован в runtime этой ветки).

## 3. Выбранная стратегия повышения надежности metadata

### 3.1 Что выбрано
Вместо «только feed + best-effort watch-page» реализован multi-source слой:
1. `feed` остается базой.
2. `watch-page` остается best-effort слоем (description/keywords/category hints).
3. Добавлен `oEmbed`-слой для более надежных `title/channel/thumbnail`.

### 3.2 Честность механизма
1. Официальный YouTube Data API в этом проходе **не** внедрялся.
2. Используется комбинация:
   - YouTube RSS feed,
   - watch-page parsing (best-effort),
   - YouTube oEmbed endpoint.
3. Там, где источник по природе best-effort, это теперь явно помечается в payload reliability-сигналах.

## 4. Поля: что стало надежнее, что осталось best-effort

### 4.1 Более надежные (по сравнению с Phase 11)
1. `title` — приоритетно из `oEmbed` (fallback: feed).
2. `thumbnail` — приоритетно из `oEmbed` (fallback: watch/feed).
3. `channel identity` (`sourceChannelId/sourceChannelTitle`) — усилено комбинацией oEmbed/watch/feed + resolved channel id.
4. `externalUrl` — стабилизирован в canonical watch URL по video id.

### 4.2 Best-effort (и это явно отражено)
1. `description/body` — feed + watch-page merge (watch может быть недоступен/нестабилен).
2. `sourceTags` — feed category terms + watch keywords (зависит от доступности и структуры страницы).
3. `sourceCategory-like signals` — по watch/page hints; при отсутствии остается слабым сигналом.

### 4.3 Новые reliability-сигналы в payload
В `sourcePayload.ingestion` теперь пишутся:
1. `metadataSources`.
2. `metadataQuality.overallReliability`.
3. `metadataQuality.fieldReliability`.
4. `metadataQuality.missingCriticalFields`.
5. `watchEnrichmentError` / `oembedEnrichmentError`.

## 5. Refine auto-mapping

### 5.1 Что изменено
1. Расширены keyword rules (включая русские сигналы).
2. Добавлены source-profile hints (по `source.slug`) для category/series/tag priors.
3. Введен более явный score-based mapping:
   - `mapping.score`,
   - confidence с учетом metadata reliability.
4. Улучшены explainability-артефакты:
   - расширенные `reasonCodes`,
   - более информативные `matchedTerms`.

### 5.2 Защита от «тихой ошибки»
1. Низкая metadata reliability может понижать mapping confidence.
2. Неуверенные случаи явно уходят в review-состояния, а не «молча публикуются».

## 6. Publish / Review decision rules (явные)
Добавлен отдельный policy-layer (`automation` в payload):
1. `publishDecision`: `keep_draft | review_required | auto_publish`.
2. `reviewState`: `review_needed | review_light | auto_published`.
3. `reasonCodes` с объяснением, почему принято решение.

Принцип:
1. Safe default: `draft`.
2. `review_required` для low/uncertain/fallback/manual-override случаев.
3. `review_light` для high-confidence, но без auto-publish.
4. `auto_publish` разрешен только при строгих условиях и только если включен `YOUTUBE_INGESTION_ENABLE_AUTOPUBLISH=true`.

## 7. Admin visibility / review queue
1. В `/admin/content` добавлен automation-фильтр:
   - `review_needed`, `review_light`, `auto_published`, `no_signals`.
2. В таблице auto-map добавлены сигналы `reviewState`, `publishDecision`, `metadata reliability`.
3. В `/admin/content/[id]` расширен блок explainability:
   - confidence + score,
   - review/publish policy,
   - metadata reliability,
   - mapping reasons + decision reasons.

## 8. Safe create/update/re-sync гарантии
Сохранено и подтверждено кодом:
1. Dedupe по `externalSourceId` не убран.
2. Snapshot/manual-override защита сохранена (ручные правки не перетираются вслепую).
3. Re-sync остается безопасным для source identity/sync history.
4. Status для существующих импортов сохраняется (policy не переопределяет вручную выставленный existing status).

## 9. Live-safe non-regression
Изменения были узкими и не затрагивали архитектурно:
1. Public routes (Home/Streams/Detail/About) не перерабатывались.
2. Auth/sign-in/sign-out, admin CMS, source registry, comments/reactions/moderation не менялись вне необходимого integration scope.
3. Build маршрутная генерация успешна (см. раздел команд).

## 10. Измененные файлы
1. `.env.example`
2. `src/server/services/youtube-ingestion-service.ts`
3. `src/server/repositories/seed-content-repository.ts`
4. `src/server/services/admin-content-service.ts`
5. `src/app/admin/content/page.tsx`
6. `src/app/admin/content/[id]/edit-content-form.tsx`
7. `src/types/content.ts`
8. `docs/ROADMAP.md`
9. `docs/reports/phase_12_reliable_youtube_metadata_and_publish_review_rules.md`

## 11. Команды, выполненные в проходе
1. Аудит кода/структуры:
   - `Get-ChildItem -Force`
   - `rg -n "ingest|youtube|mapping|confidence|review|draft|auto" -S src supabase docs`
   - `Get-Content` по ключевым файлам ingestion/repository/admin
2. Проверки:
   - `npm run lint` — успешно.
   - `npm run build` — успешно.
   - `NODE_OPTIONS=--conditions=react-server npx tsx scripts/phase05-ingestion-smoke.ts` — выполнено.

## 12. Результаты проверок
1. Lint: успешно.
2. Build: успешно.
3. Ingestion smoke:
   - duplicateExternalIds = `0` (дубли не создаются),
   - anti-concurrency guard срабатывает,
   - lock snapshot очищается,
   - сценарий `rerun` в этом прогоне вернул `failed` (не скрывается, зафиксировано как текущее operational поведение).

## 13. Что не менялось в этом проходе
1. Не делался broad SEO pass.
2. Не внедрялся comment reputation.
3. Не делался глобальный редизайн.
4. Не менялась общая auth-архитектура.
5. Не внедрялся полноценный enterprise ingestion stack (очереди/оркестратор/алертинг).

## 14. Что остается долгом следующей фазы
1. Масштабный backfill и калибровка rule-set на большем реальном датасете.
2. Отдельная стабилизация/диагностика `rerun`-сценариев `retry_failed_items`.
3. После стабилизации automation rails — SEO/performance/indexing.
4. Далее отдельной фазой — comment reputation system.

## 15. Самопроверка по acceptance
1. Automation reliability улучшен (multi-source + field reliability + policy layer) — да.
2. Mapping decisions более явные и reviewable — да.
3. Publish/review logic явный и безопасный — да.
4. Create/update safety сохранен — да.
5. Live product flows не удалялись/не ломались кодовым проходом — да (build + scope audit).
6. Build succeeded — да.
7. `docs/ROADMAP.md` обновлен — да.
8. Отчет сохранен по требуемому пути — да.
