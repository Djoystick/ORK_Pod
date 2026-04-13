# Phase 21 — Taxonomy Cleanup и Playlist Sync Foundation

## 1) Стартовое состояние (фактический аудит)

### Таксономия и импортированный корпус
1. По локальному файлу `data/local-content-items.json` на момент аудита:
   - всего записей: `59`;
   - imported: `45`;
   - manual: `0`.
2. Распределение imported по текущим категориям/сериям было равномерным и всё ещё частично наследовало legacy-нейминг:
   - категории: `cat-analysis=15`, `cat-community=15`, `cat-practice=15`;
   - серии: `series-archive-notes=15`, `series-qna-room=15`, `series-tooling-lab=15`.
3. Топ тегов imported-корпуса на старте:
   - `tag-streaming=44`, `tag-community=16`, `tag-archive=15`, `tag-analytics=15`, `tag-obs=15`, `tag-process=15`, `tag-automation=15`.

### Test/demo артефакты
1. В локальном файле корпуса обнаруживались legacy demo-паттерны (`item-###` + `inside-stream-*|retro-air-*|live-build-*|qna-room-*|archive-notes-*|tooling-lab-*`): `14` записей.
2. В Supabase стороне до этого прохода не было выделенного playlist-слоя и playlist sync telemetry в `source_channels`.

### Playlist состояние
1. На локальном fallback до прохода отсутствовали playlist-файлы:
   - `data/local-playlists.json` — отсутствовал;
   - `data/local-playlist-items.json` — отсутствовал.
2. В коде ingestion не было first-class playlist entity в контракте репозитория.

---

## 2) Что изменено по таксономии

1. Обновлены справочники в коде (`categories`, `series`, `tags`) под реальный тематический профиль корпуса ORKPOD (новости/разборы, стримы/кооп, нарезки, Blizzard/WoW/Diablo, симуляторы и т.д.).
2. Обновлены seed-данные Supabase в той же логике, чтобы локальный и SQL bootstrap не расходились.
3. Обновлены source-channel сиды:
   - для `orkpod-youtube` закреплён канонический `external_channel_id=UCPZZring891k7JVnr70dlIw`;
   - обновлена тематическая заметка канала.
4. Детерминированный auto-mapping дополнен playlist-сигналами (см. раздел 5).

---

## 3) Что сделано с test/demo записями

1. Добавлен детектор legacy demo-контента: `src/lib/content-record-flags.ts`.
2. Local fallback очистка:
   - `readLocalFallbackContentItems()` теперь фильтрует legacy demo-записи;
   - после фильтрации локальный JSON перезаписывается уже без таких записей.
3. Bootstrap защитён от повторного возврата legacy demo-шаблонов:
   - `DEFAULT_BOOTSTRAP_SLUGS` очищен;
   - шаблоны проходят через `isLegacyDemoContentItem`.
4. Supabase migration (без разрушительного удаления):
   - legacy demo manual-паттерны переводятся в `archived` (а не hard-delete), с фиксацией времени.

Что важно: в этом проходе сделан **безопасный path “удалить с production-facing поверхностей/архивировать”**, а не массовое физическое удаление данных.

---

## 4) Модель playlist как first-class entity

1. Добавлены типы доменной модели:
   - `Playlist`;
   - `PlaylistItem`.
2. Расширен `SourceChannel` telemetry-полями playlist sync:
   - `lastPlaylistSyncedAt`, `lastPlaylistCount`, `lastPlaylistItemCount`,
   - `playlistSyncMode`, `playlistSyncMessage`.
3. Контракт `ContentRepository` расширен методом:
   - `listPlaylists(options?: { sourceChannelId?: string; limit?: number })`.
4. Реализации добавлены:
   - Supabase repository;
   - Seed/local fallback repository;
   - Fallback wrapper (`content-repository.ts`).

---

## 5) Playlist sync foundation

1. В `youtube-ingestion-service.ts` добавлен отдельный API-backed playlist sync path:
   - `fetchYouTubeChannelPlaylists(...)`;
   - нормализация `NormalizedYouTubePlaylist` и `NormalizedYouTubePlaylistItem`;
   - режимы результата: `api_primary | disabled_no_api_key | error`.
2. Добавлены env-контролы:
   - `YOUTUBE_DATA_API_PLAYLIST_MAX_PLAYLISTS_PER_SOURCE`;
   - `YOUTUBE_DATA_API_PLAYLIST_MAX_ITEMS_PER_PLAYLIST`.
3. Supabase persistence:
   - upsert в `playlists`;
   - пересборка membership в `playlist_items`;
   - деактивация отсутствующих playlist для source;
   - запись telemetry обратно в `source_channels`.
4. Local fallback persistence:
   - новые файлы `data/local-playlists.json`, `data/local-playlist-items.json`;
   - безопасная перезапись per-source.
5. Интеграция в mapping:
   - playlist titles/ids добавляются как сигналы;
   - улучшаются `matchedTerms` и `reasonCodes`;
   - сохраняется детерминированная explainability.

---

## 6) Admin/операционная видимость

1. В `/admin/sources` добавлены:
   - колонка `Playlist sync` по source channel;
   - блок “Синхронизированные playlists” с ключевыми метриками (`items`, `linked`, `active`).
2. `admin-source-service` теперь отдаёт `playlists` через `repository.listPlaylists({ limit: 40 })`.
3. Видимость сделана операционной и узкой (без отдельного “большого dashboard”).

---

## 7) Изменения в БД (migration)

Добавлен файл:
- `supabase/migrations/20260413130000_phase_21_taxonomy_cleanup_playlist_sync_foundation.sql`

Содержимое migration:
1. Новые поля в `source_channels` для playlist telemetry.
2. Новые таблицы:
   - `playlists`;
   - `playlist_items`.
3. Индексы, триггеры `updated_at`, RLS и политики доступа.
4. SQL-апдейты taxonomy (categories/series/tags) и `orkpod-youtube` channel id.
5. Безопасная архивация legacy demo manual-паттернов.

---

## 8) Файлы, изменённые в проходе

1. `src/types/content.ts`
2. `src/types/repository.ts`
3. `src/server/repositories/content-repository.ts`
4. `src/server/repositories/supabase-content-repository.ts`
5. `src/server/repositories/seed-content-repository.ts`
6. `src/server/services/youtube-ingestion-service.ts`
7. `src/server/services/admin-source-service.ts`
8. `src/server/services/content-bootstrap-service.ts`
9. `src/server/storage/local-fallback-store.ts`
10. `src/lib/content-record-flags.ts` (new)
11. `src/app/admin/sources/page.tsx`
12. `src/app/admin/sources/source-registry-form.tsx`
13. `src/data/categories.ts`
14. `src/data/series.ts`
15. `src/data/tags.ts`
16. `src/data/source-channels.ts`
17. `supabase/seed.sql`
18. `supabase/migrations/20260413130000_phase_21_taxonomy_cleanup_playlist_sync_foundation.sql` (new)
19. `docs/ROADMAP.md`
20. `docs/reports/phase_21_taxonomy_cleanup_and_playlist_sync_foundation.md`

---

## 9) Команды, выполненные в проходе

1. `git status --short`
2. `rg -n "rowToPlaylistItem|DbPlaylistItemRow|PlaylistItem" src/server/repositories/supabase-content-repository.ts`
3. Серия `Get-Content`/`rg` по изменённым файлам для аудита и верификации wiring.
4. `npm run lint`
5. `npm run build`
6. Аудит локального корпуса/каналов:
   - подсчёт imported/manual/demo;
   - группировки по category/series/tag;
   - проверка наличия playlist fallback файлов.

---

## 10) Результаты проверок

1. `npm run lint` — успешно.
2. `npm run build` — успешно.
3. Публичные маршруты и admin-маршруты не удалялись и не переархитектуривались в этом проходе.

---

## 11) Что намеренно НЕ менялось

1. Не выполнялся новый большой UI redesign (вне scope).
2. Не менялась логика comment reputation/trust moderation (вне scope).
3. Не переписывалась ingestion-архитектура целиком — добавлен только playlist foundation.
4. Не добавлялся широкий playlist product-suite (управление вручную, редактор плейлистов, сложная публичная витрина).

---

## 12) Что осталось как manual/live debt

1. Для реального playlist sync в production нужен валидный `YOUTUBE_DATA_API_KEY` и деплой migration в боевую БД.
2. Нужна post-deploy проверка на live:
   - что playlist sync запускается по source sync;
   - что `playlists`/`playlist_items` заполняются;
   - что telemetry и admin-блок отражают реальные значения.
3. Дополнительная калибровка taxonomy по мере роста корпуса остаётся следующим операционным шагом.
