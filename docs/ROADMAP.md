# ORKPOD Archive Roadmap (после Phase 17)

## Текущее состояние продукта
1. Публичные маршруты работают: `/`, `/streams`, `/streams/[slug]`, `/about`.
2. Брендинг (green ork, icon, hero background) сохранён.
3. Auth/admin/community/ingestion flow остаются рабочими без архитектурной перестройки.
4. Фазы 11-14B по automation (API-backed ingestion, exact tags, runtime parity) сохранены.
5. Phase 15 завершён: структурирование импортированных описаний + UTF-8 cleanup.
6. Phase 16 завершён: SEO / performance / indexing foundation (metadata, robots, sitemap, structured data).
7. Phase 17 завершён: media/detail UX обновлён (embedded player над описанием + collapsible description).

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
22. Phase 17 — выполнено (media/detail player + collapsible description).

## Что сделано в Phase 17
1. На detail page добавлен реальный embedded player для поддерживаемых источников (YouTube/Twitch), и он расположен выше описания.
2. Для неподдерживаемых/непарсируемых ссылок реализован безопасный fallback без поломки страницы:
   - показывается медиаблок с cover/thumbnail;
   - сохраняется действие открытия внешнего источника.
3. Описание вынесено в collapsible/expandable блок:
   - стартовое состояние свернуто для более чистого первого экрана;
   - полный текст доступен по раскрытию;
   - structured imported description из Phase 15 сохранён.
4. Внешние ссылки, теги, community comments/reactions блок и related-карточки сохранены.

## Следующие roadmap-блоки
1. Cover improvements (следующий слой улучшений медиа-представления).
2. Admin bulk publish для publish-ready элементов.
3. Comment reputation system.
4. Большой UI pass, вдохновлённый Pixabay (позже отдельной фазой).
