# ORKPOD Archive Roadmap (после Phase 19)

## Текущее состояние продукта
1. Публичные маршруты работают: `/`, `/streams`, `/streams/[slug]`, `/about`.
2. Брендинг ORKPOD (green ork, icon, hero background) сохранён.
3. Auth/admin/community/ingestion flow остаются рабочими.
4. YouTube ingestion работает в live-режиме, API-backed путь и exact tags активированы в предыдущих фазах.
5. SEO / performance / indexing foundation уже внедрены.
6. Detail UX обновлён: embedded player над описанием + collapsible description.
7. Cover readiness и admin bulk publish workflow уже внедрены.
8. Phase 19 завершён: добавлена базовая система репутации комментариев и trust-модерации.

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
24. Phase 19 — выполнено (comment reputation + trust moderation rules).

## Что сделано в Phase 19
1. Добавлена модель `+ / -` feedback для комментариев с защитой от дубликатов голосования и toggle/update поведением.
2. Введён коэффициент репутации автора комментариев по явной формуле: `(positive + 1) / (negative + 1)`.
3. Интегрированы trust-правила модерации новых комментариев:
   - коэффициент `> 1` -> автопубликация;
   - коэффициент `< 1` -> отправка на модерацию;
   - коэффициент `= 1` (новый/нейтральный профиль) -> безопасный pending.
4. На публичной странице добавлены `+ / -` действия для комментариев и видимый баланс голосов.
5. В `/admin/moderation` добавлена trust-видимость: коэффициент автора, статистика `+/-`, trust decision и причина модерации.
6. Добавлена миграция Supabase для `comment_feedback` и trust-полей комментария.

## Следующие roadmap-блоки
1. Broader community polish (тонкая калибровка trust-модели, UX очереди модерации, анти-абьюз улучшения).
2. Further media/cover polish при необходимости.
3. Большой Pixabay-inspired UI pass отдельной фазой.
