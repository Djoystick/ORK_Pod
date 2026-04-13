# ORKPOD Archive Roadmap (после Phase 21)

## Текущее состояние продукта
1. Публичные маршруты работают: `/`, `/streams`, `/streams/[slug]`, `/about`.
2. Брендинг ORKPOD (green ork, icon, hero background) сохранён.
3. Auth/admin/community/ingestion потоки остаются рабочими.
4. Live YouTube sync и API-backed ingestion с exact tags сохранены.
5. SEO / performance / indexing foundation сохранены.
6. Detail UX (embedded player над описанием + collapsible description) сохранён.
7. Cover readiness и bulk publish workflow сохранены.
8. Comment reputation + trust moderation rules (Phase 19) работают.
9. Phase 20 public UI/UX overhaul сохранён.
10. Phase 21: выполнена очистка таксономии и добавлен foundation для playlist entity + playlist sync.

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
18. Phase 14A — выполнено.
19. Phase 14B — выполнено.
20. Phase 15 — выполнено.
21. Phase 16 — выполнено.
22. Phase 17 — выполнено.
23. Phase 18 — выполнено.
24. Phase 19 — выполнено.
25. Phase 20 — выполнено.
26. Phase 21 — выполнено (taxonomy cleanup + playlist sync foundation).

## Что сделано в Phase 21
1. Таксономия (categories/series/tags) выровнена под реальные повторяющиеся темы импортированного корпуса.
2. В ingestion mapping добавлены playlist-сигналы (playlist title/id) для более объяснимого и детерминированного auto-mapping.
3. Введена first-class playlist модель: `Playlist` и `PlaylistItem`.
4. Добавлен playlist sync foundation на YouTube Data API path (при наличии `YOUTUBE_DATA_API_KEY`).
5. Добавлена персистенция playlists/playlist_items для Supabase и local fallback.
6. В source registry добавлена операционная видимость playlist sync telemetry и списка синхронизированных playlists.
7. Добавлена безопасная очистка legacy demo-записей в local fallback path и SQL-архивация demo-паттернов для Supabase.

## Следующие roadmap-блоки
1. Дальнейший playlist UX/discovery polish на публичных поверхностях (без ломки текущей операционной модели).
2. Дополнительная калибровка таксономии по мере роста реального корпуса.
3. Operational polish по live-наблюдениям (очереди, отчётность, backfill-процедуры).
