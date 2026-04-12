# ORKPOD Archive Roadmap (после Phase 18)

## Текущее состояние продукта
1. Публичные маршруты работают: `/`, `/streams`, `/streams/[slug]`, `/about`.
2. Брендинг (green ork, icon, hero background) сохранён.
3. Auth/admin/community/ingestion flow остаются рабочими без архитектурной перестройки.
4. Фазы 11-14B по automation (API-backed ingestion, exact tags, runtime parity) сохранены.
5. Phase 15 завершён: структурирование импортированных описаний + UTF-8 cleanup.
6. Phase 16 завершён: SEO / performance / indexing foundation.
7. Phase 17 завершён: embedded player над описанием + collapsible description на detail page.
8. Phase 18 завершён: cover readiness усилен + добавлен безопасный admin bulk publish для publish-ready материалов.

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
23. Phase 18 — выполнено (cover readiness + bulk publish-ready workflow).

## Что сделано в Phase 18
1. Усилен cover path на уровне resolve слоя:
   - если `cover.kind=image` отсутствует, для YouTube-материалов безопасно достраивается thumbnail из ссылки/ID;
   - при отсутствии thumbnail сохраняется безопасный gradient fallback.
2. Введены явные publish-ready правила для bulk publish:
   - обязательные базовые проверки (draft/status, title, slug, primary link, description/excerpt/body, cover);
   - для imported добавлены automation safety проверки (confidence/review/publishDecision/metadataReliability).
3. Добавлен admin bulk publish action:
   - owner-triggered действие публикует только записи, прошедшие readiness rules;
   - показывается счётчик eligible/blocked/failed.
4. Добавлена visibility в `/admin/content`:
   - фильтр `Publish ready` (all/ready/blocked);
   - per-item ready/blocked badge + причины блокировки;
   - operational summary для draft/ready/blocked.

## Следующие roadmap-блоки
1. Comment reputation system.
2. Broader cover/media polish (следующий уровень art-direction вне операционного scope).
3. Большой UI pass, вдохновлённый Pixabay (позже отдельной фазой).
