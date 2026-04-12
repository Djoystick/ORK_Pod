# Phase 14A — live ingestion lock storage fix (EROFS на `/admin/sources`)

Дата: 2026-04-12  
Проект: ORKPOD Archive

## 1) Контекст и проблема
На live (Vercel) наблюдался production blocker:

`EROFS: read-only file system, open '/var/task/data/local-ingestion-locks.json'`

Симптом проявлялся на `GET /admin/sources`.

## 2) Точный root cause
1. Путь рендера `/admin/sources` вызывает `getAdminSourceRegistryData(...)` в `src/server/services/admin-source-service.ts`.
2. Этот сервис всегда запрашивает `getIngestionLockSnapshot()` из `src/server/services/ingestion-job-service.ts`.
3. `getIngestionLockSnapshot()` читает lock snapshot через `readLocalIngestionLocks()` из `src/server/storage/local-fallback-store.ts`.
4. До фикса `readLocalIngestionLocks()/writeLocalIngestionLocks()` всегда использовали файловый backend:
   - `data/local-ingestion-locks.json`.
5. На Vercel production runtime (`/var/task`) filesystem read-only, что и приводило к `EROFS`.

## 3) Что изменено

### A. Production-safe lock storage strategy
В `src/server/storage/local-fallback-store.ts` добавлена явная стратегия хранения ingestion locks:

1. `NODE_ENV=production` -> `memory_ephemeral` (без доступа к локальному файлу).
2. Local/dev по умолчанию -> `file_local_json` (сохранён прежний режим).
3. Добавлен optional local override:
   - `ORKPOD_INGESTION_LOCK_STORE=memory|file|file_local_json`.
4. Для memory режима используется global snapshot в процессе:
   - `globalThis.__ORKPOD_MEMORY_INGESTION_LOCK_SNAPSHOT__`.

### B. Local/fallback behavior
1. Local/dev file store не удалён.
2. Файловый `local-ingestion-locks.json` остаётся доступным для локальной эксплуатации и fallback сценариев.
3. Production путь теперь явно отделён от local и не пишет lock snapshot в файловую систему.

### C. Конфигурация
В `.env.example` добавлен параметр:
1. `ORKPOD_INGESTION_LOCK_STORE=`
2. Описано, что в production lock store принудительно in-memory.

## 4) Почему это решает `/admin/sources`
Даже если `/admin/sources` продолжает вызывать `getIngestionLockSnapshot()`, в production runtime snapshot теперь читается/обновляется в memory backend, без `writeFile/readFile` в `/var/task/data/*.json`.  
Следовательно, этот конкретный `EROFS` класс ошибки для ingestion lock store устранён.

## 5) Safety guarantees (не ослаблены)
Проверено, что логика блокировок сохранена:
1. anti-concurrency guard работает;
2. sync-all guard работает;
3. rerun flow работает;
4. dedupe не ломается.

Важно: в production memory locks по природе process-local (ephemeral), но это ожидаемое serverless-safe поведение и значительно лучше аварии маршрута. В рамках узкого 14A прохода locking не удалялся и не упрощался.

## 6) Файлы, задействованные в фиксе
1. `src/server/storage/local-fallback-store.ts`
2. `.env.example`
3. `docs/ROADMAP.md`
4. `docs/reports/phase_14A_live_ingestion_lock_storage_fix.md`

## 7) Команды, выполненные в этом проходе
1. `npm run lint`
2. `npm run build`
3. `npx tsx --conditions=react-server scripts/phase05-ingestion-smoke.ts`
4. Production-mode runtime check lock-store (ad-hoc):
   - `NODE_ENV=production` + вызовы `readLocalIngestionLocks()/writeLocalIngestionLocks()` через `tsx`.

## 8) Результаты проверок
1. `npm run lint` — успешно.
2. `npm run build` — успешно.
3. Ingestion smoke — успешно:
   - dedupe stable (`duplicateExternalIds: 0`);
   - anti-concurrency guard активен;
   - sync-all guard активен;
   - rerun path успешен.
4. Production-mode lock-store check — успешно:
   - read/write lock snapshot выполняются без filesystem errors.

## 9) Что всё ещё требует post-deploy live подтверждения
1. Проверить на Vercel после выката:
   - `GET /admin/sources` больше не возвращает `EROFS`;
   - связанные ingestion/admin маршруты (`/admin/imports`, sync/rerun actions) не ловят тот же класс ошибки.
2. Это live confirmation не фейковался и в рамках локального прохода не заявляется как уже выполненный.

## 10) Итог
Phase 14A выполнен как узкий production hotfix:
1. ingestion lock storage больше не использует filesystem в production path;
2. `/admin/sources` готов перестать падать по этому же `EROFS` root cause;
3. locking safeguards сохранены;
4. build/lint успешны.
