# Phase 09B — Fix: graceful degradation для ingestion-runtime в `/admin`

## 1. Цель прохода
Устранить production 500 на `GET /admin`, вызванный ожидаемым runtime-ограничением ingestion-path в Supabase-репозитории, без ослабления общей production safety-модели.

## 2. Фактический стартовый контекст
1. После Phase 09A public/admin функциональность в целом сохранена.
2. В runtime есть намеренно неактивные методы ingestion в Supabase-репозитории (они бросают исключение).
3. `/admin` агрегировал import-метрики и падал, если прилетало исключение вида:
   - `Supabase ingestion path is not active in this phase runtime. Fallback repository will be used.`

## 3. Точная первопричина
1. `src/app/admin/page.tsx` вызывает `getAdminOverviewData()`.
2. В `src/server/services/admin-content-service.ts` выполнялся вызов `repository.listImportRuns(...)`.
3. Для выбранного runtime-режима использовался `SupabaseContentRepository`, где ingestion-методы намеренно `throw` при неактивном ingestion-runtime.
4. Ошибка не деградировала в UI-состояние и поднималась до SSR, что приводило к 500 на `/admin`.

## 4. Что изменено (узко по scope)

### 4.1 Новый guard для распознавания ожидаемой ошибки ingestion-runtime
Добавлен файл:
1. `src/server/services/ingestion-runtime-guard.ts`

Содержит:
1. `isIngestionRuntimeUnavailableError(error)` — распознает известный runtime-limit по сообщению.
2. `getIngestionRuntimeUnavailableMessage()` — возвращает текст warning для UI.

### 4.2 Service-layer: graceful degradation только для ingestion runtime-limit
Обновлен файл:
1. `src/server/services/admin-content-service.ts`

Изменения:
1. `getAdminOverviewData()` больше не валит страницу, если `listImportRuns()` бросает известную ingestion-runtime ошибку.
2. В этом случае:
   - `importRuns = []`
   - в ответ добавляется `ingestionRuntimeWarning`.
3. Любые другие (неожиданные) ошибки по-прежнему пробрасываются (fail-fast сохранен).

Обновлен файл:
1. `src/server/services/admin-source-service.ts`

Изменения:
1. `getAdminSourceRegistryData()` — `recentRuns` деградирует в пустой список + warning.
2. `getAdminImportsData()` — `runs` деградирует в пустой список + warning.
3. `getAdminImportRunDetailsData()`:
   - при runtime-limit возвращает `ingestionRuntimeUnavailable = true` и warning;
   - не падает 500;
   - оставляет fail-fast для нецелевых ошибок.

### 4.3 Admin UI: отображение ограниченного режима вместо фатала
Обновлены файлы:
1. `src/app/admin/page.tsx`
2. `src/app/admin/sources/page.tsx`
3. `src/app/admin/sources/source-registry-form.tsx`
4. `src/app/admin/imports/page.tsx`
5. `src/app/admin/imports/[id]/page.tsx`

Изменения:
1. Добавлены warning-блоки при наличии `ingestionRuntimeWarning`.
2. На `/admin/imports/[id]` при `run = null` и `ingestionRuntimeUnavailable = true` рендерится понятное состояние «раздел временно недоступен» вместо `notFound()`/фатала.
3. Admin shell и остальные блоки продолжают рендериться.

## 5. Как теперь работает graceful degradation
1. Если ingestion runtime неактивен, импортные виджеты/разделы показывают ограниченный режим (warning + пустые данные), но `/admin` не падает.
2. CMS/контентные части админки остаются доступными.
3. Безопасностная модель не ослаблена:
   - глобальный silent fallback не включался;
   - перехватывается только ожидаемый ingestion-runtime limit.

## 6. Команды, выполненные в этом проходе
1. Аудит файлов и вызовов:
   - `git status --short`
   - `rg --files src/app/admin`
   - `rg -n "ingestionRuntimeWarning|ingestionRuntimeUnavailable" src/server/services src/app/admin`
   - `Get-Content ...` по целевым admin/service файлам
2. Проверка сборки:
   - `npm run build`
3. Локальный smoke-подход для `/admin` (dev-сервер + `Invoke-WebRequest`) был предпринят, но HTTP-коннект к локальному порту в текущем окружении не подтвердился.

## 7. Результаты проверки
1. `npm run build` — успешно.
2. Измененные admin-маршруты присутствуют в build output:
   - `/admin`
   - `/admin/sources`
   - `/admin/imports`
   - `/admin/imports/[id]`
3. По коду устранен путь, где ingestion-runtime limit приводил к фатальному SSR-исключению на `/admin`.

## 8. Что подтверждено, а что требует live-подтверждения

### Подтверждено
1. Исправление реализовано в сервисах и UI.
2. Проект успешно собирается после изменений.
3. Для ingestion-runtime limit теперь есть деградационный рендер-контракт, а не аварийное падение.

### Требует подтверждения после деплоя
1. Проверить на Vercel, что `GET /admin` больше не возвращает 500 по этой же причине.
2. Проверить аналогичное поведение для `/admin/sources`, `/admin/imports`, `/admin/imports/[id]` в production-окружении.

## 9. Что не менялось в рамках этого прохода
1. Не менялась архитектура ingestion pipeline.
2. Не ослаблялись auth/RLS и production boundary правила.
3. Не вносились изменения в SQL/миграции (не требовалось для этого бага).
4. Не добавлялись новые продуктовые функции.
