# Phase 19 — Comment Reputation и Trust Moderation Rules

## 1) Фактическое стартовое состояние
1. Комментарии уже работали, но новые комментарии всегда создавались в `pending` без trust-коэффициента автора.
2. Реакции существовали только на уровне материала (`like/love/insight/fire`), а не на уровне комментариев.
3. В модерации не было отдельной видимости репутации автора и trust-обоснования авто-решения.
4. Защита от дубликатов по реакциям на материал уже была, но для `+/-` на комментариях модели ещё не существовало.

## 2) Выбранная модель feedback (`+ / -`)
1. Добавлена отдельная сущность `comment_feedback` (Supabase + local fallback):
   - `feedback_type`: `up | down`;
   - привязка к `comment_id` и `content_item_id`;
   - actor identity: `actor_user_id` (если есть) + `actor_fingerprint`.
2. Правила голосования:
   - если пользователь нажимает тот же знак повторно -> голос снимается (`removed`);
   - если нажимает противоположный знак -> голос обновляется (`updated`);
   - если голоса ещё не было -> создаётся (`created`).
3. Ограничение повторов реализовано на двух уровнях:
   - в логике `upsert` (toggle/update вместо неограниченных вставок);
   - уникальные индексы в БД по `comment_id + actor_user_id` (partial) и `comment_id + actor_fingerprint`.
4. Добавлен запрет голосования за собственный комментарий.

## 3) Модель коэффициента репутации автора
1. Введена явная формула:
   - `coefficient = (positive + 1) / (negative + 1)`.
2. Почему так:
   - коэффициент детерминированный и объяснимый;
   - сглаживание `+1` предотвращает нестабильность на малых выборках;
   - новый/нейтральный профиль получает коэффициент `1.000`.
3. В репутационном snapshot также считаются:
   - `totalPositive`, `totalNegative`, `totalVotes`;
   - `totalComments`, `ratedComments`;
   - `signal` (`low/medium/high`) как индикатор объёма сигналов.

## 4) Интеграция trust-правил в модерацию новых комментариев
1. Перед созданием комментария вычисляется текущая репутация автора.
2. Решение модерации:
   - `coefficient > 1` -> `status=approved`, `moderation_status=clean`, trust decision `auto_publish`;
   - `coefficient < 1` -> `status=pending`, `moderation_status=pending_review`, trust decision `moderation_required`;
   - `coefficient = 1` -> безопасный `pending`, trust decision `neutral_pending`.
3. В комментарии сохраняются:
   - `author_reputation_coefficient`;
   - `trust_decision`;
   - `moderation_reason` с явным объяснением, какое trust-правило сработало.
4. Это меняет поведение модерации согласно требованию, но не ослабляет безопасный default для нейтральных/новых аккаунтов.

## 5) Публичный UI
1. В блок комментариев добавлены кнопки `+` и `-` для каждого опубликованного комментария.
2. Отображается текущий баланс и счётчики `+/-`.
3. Подсвечивается активный голос текущего пользователя.
4. Режимы `canWrite`/auth-ограничения сохранены, без редизайна всего community-блока.

## 6) Admin visibility
1. В `/admin/moderation` добавлен столбец `Trust`:
   - коэффициент автора;
   - агрегат `+/-`;
   - `trust decision`.
2. Причина модерации (`moderationReason`) остаётся видимой и теперь включает trust-обоснование, если решение принято автоматически.

## 7) Изменения в Supabase/хранилище
1. Новая миграция:
   - `supabase/migrations/20260413082000_phase_19_comment_reputation_foundation.sql`.
2. Что добавлено:
   - таблица `comment_feedback`;
   - индексы и RLS policies для неё;
   - в `comments` добавлены поля `author_reputation_coefficient` и `trust_decision` с check-constraint.
3. В local fallback добавлено JSON-хранилище `local-comment-feedback.json` и соответствующие read/write функции.

## 8) Изменённые файлы
1. `src/types/content.ts`
2. `src/types/repository.ts`
3. `src/lib/comment-reputation.ts` (новый)
4. `src/server/storage/local-fallback-store.ts`
5. `src/server/repositories/content-repository.ts`
6. `src/server/repositories/seed-content-repository.ts`
7. `src/server/repositories/supabase-content-repository.ts`
8. `src/server/services/community-service.ts`
9. `src/app/streams/[slug]/community-actions.ts`
10. `src/components/community/community-block.tsx`
11. `src/app/admin/moderation/page.tsx`
12. `supabase/migrations/20260413082000_phase_19_comment_reputation_foundation.sql` (новый)
13. `docs/ROADMAP.md`
14. `docs/reports/phase_19_comment_reputation_and_trust_moderation_rules.md` (этот отчёт)

## 9) Команды, выполненные в ходе прохода
1. Аудит кода (`rg`, `Get-Content`) по community/repository/migration путям.
2. `npm run lint`
3. `npm run build`

## 10) Результат проверок
1. `npm run lint` — успешно.
2. `npm run build` — успешно.

## 11) Что намеренно не менялось
1. Не выполнялся большой редизайн сайта и community UI.
2. Не менялись auth/admin архитектура и ingestion-пайплайн.
3. Не делался Pixabay-inspired UI pass.
4. Не добавлялись новые social-механики вне scoped `+/-` feedback и trust-модерации комментариев.

## 12) Остаточный долг / что требует живой валидации после деплоя
1. Нужна post-deploy проверка на live-среде реального поведения trust-модерации при разных коэффициентах (`<1`, `=1`, `>1`).
2. Нужна живая проверка UX сценариев голосования с несколькими аккаунтами и self-vote блокировкой.
3. Калибровка порогов и анти-абьюз правил может потребоваться после накопления реальных данных (это следующий уровень community polish).
