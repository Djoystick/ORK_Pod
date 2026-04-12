# Phase 18 — Cover Readiness и Bulk Publish Workflow

## 1) Стартовое состояние (фактически)
1. Публичный UI уже использовал cover на карточках/деталях, но покрытие image cover было неоднородным:
   - для части imported/manual элементов оставался только gradient fallback;
   - thumbnail не всегда подхватывался консистентно, если `cover.src` не был заполнен в источнике.
2. Админка имела одиночные статусные операции (редактирование/публикация по одной записи), но не имела безопасного массового publish по явным readiness-правилам.
3. Automation сигналы (confidence/review/publishDecision/metadata reliability) уже присутствовали в source payload для imported, но не использовались как единые жёсткие критерии bulk publish.

## 2) Что сделано по Cover Readiness

### 2.1 Единый cover resolver
- Добавлен `src/lib/cover.ts` с `resolveContentItemCover`.
- Логика:
  1. Если у записи уже есть валидный `cover.kind=image + cover.src`, он используется как source-of-truth.
  2. Если image-cover нет, для YouTube-доступных ссылок/ID строится thumbnail URL (`i.ytimg.com/vi/<id>/hqdefault.jpg`).
  3. Если thumbnail вывести нельзя — остаётся безопасный gradient fallback.

### 2.2 Подключение в общий resolve pipeline
- Обновлён `src/lib/content.ts`: в `resolveContentItems` cover нормализуется через `resolveContentItemCover`.
- Эффект: единое поведение для archive cards, detail hero/player area и metadata-путей, которые используют resolved item.

## 3) Publish-ready rules (явно и безопасно)
- Добавлен `src/lib/publish-readiness.ts` с единым evaluator `evaluatePublishReadiness`.

### 3.1 Базовые обязательные критерии (для всех)
1. `status === draft`.
2. Внятный `title` (минимальная длина).
3. Валидный `slug`.
4. Наличие рабочей primary external ссылки (`http/https`).
5. Наличие содержательного текстового блока (`excerpt/description/body`).
6. Наличие usable cover (image или безопасный gradient fallback).

### 3.2 Дополнительные критерии для imported
1. `mapping confidence` не ниже `medium`.
2. `review state` только `review_light` или `auto_published`.
3. `publish decision` не `review_required`.
4. `metadata reliability` не ниже `medium`.

Итого: uncertain/low-signal imported элементы не попадают в bulk publish автоматически.

## 4) Bulk Publish Workflow (admin)

### 4.1 Серверная операция
- Добавлена функция `bulkPublishReadyContentViaRepository` в `src/server/services/admin-content-service.ts`.
- Поток:
  1. Проверка admin write access (`assertAdminWriteAccess`, включая bootstrap key policy).
  2. Загрузка admin content items.
  3. Оценка readiness для каждого item единым evaluator.
  4. Публикация только `isReady === true`.
  5. Возврат operational-результата: draft/eligible/published/blocked/failed.

### 4.2 Admin action
- Добавлена server action `bulkPublishReadyContentAction` в `src/app/admin/content/[id]/actions.ts`.
- Возвращает оператору итог с числами `published/eligible/blocked/failed`.

### 4.3 UI-форма bulk publish
- Добавлен `src/app/admin/content/bulk-publish-ready-form.tsx`.
- На `/admin/content` отображается:
  - draft count;
  - ready count;
  - blocked count;
  - ready count в текущем фильтре;
  - кнопка intentional запуска bulk publish;
  - поле bootstrap key (когда policy требует).

## 5) Visibility в `/admin/content`
- Обновлён `src/app/admin/content/page.tsx`:
  1. добавлен фильтр `Publish ready` (`all/ready/blocked`);
  2. добавлена колонка `Publish-ready` (badge + причины блокировки);
  3. подключён bulk publish operational block.
- Обновлён `src/server/services/admin-content-service.ts`:
  - возвращает `publishReadinessById` и `publishReadinessSummary`;
  - фильтрация учитывает readiness-состояние.

## 6) Безопасность и non-regression
1. Публичные archive/detail маршруты не ломались.
2. Embedded player + collapsible description (Phase 17) сохранены.
3. Auth/admin/community/ingestion flows не менялись архитектурно.
4. Bulk publish не публикует «всё подряд», а только записи, прошедшие явные readiness checks.

## 7) Изменённые файлы
1. `src/lib/cover.ts` (новый)
2. `src/lib/content.ts`
3. `src/lib/publish-readiness.ts` (новый)
4. `src/server/services/admin-content-service.ts`
5. `src/app/admin/content/[id]/actions.ts`
6. `src/app/admin/content/bulk-publish-ready-form.tsx` (новый)
7. `src/app/admin/content/page.tsx`
8. `docs/ROADMAP.md`
9. `docs/reports/phase_18_cover_readiness_and_bulk_publish_workflow.md`

## 8) Команды, выполненные в ходе прохода
1. `rg -n ...` (аудит cover/automation/publish paths).
2. `Get-Content ...` (аудит admin/repository/detail/service файлов).
3. `npm run lint`.
4. `npm run build`.
5. Повторно `npm run lint` и `npm run build` после итоговых правок.

## 9) Результат проверок
- `npm run lint` — успешно.
- `npm run build` — успешно.

## 10) Что намеренно не менялось
1. Не реализована comment reputation system.
2. Не выполнялся большой Pixabay-inspired UI pass.
3. Не делался широкий редизайн cover/art-direction beyond operational scope.
4. Не менялась ingestion архитектура и auth модель.
