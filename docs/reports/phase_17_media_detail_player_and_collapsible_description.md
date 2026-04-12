# Phase 17 — Media Detail Player + Collapsible Description

## 1) Стартовое состояние detail page (фактически)
1. На странице `/streams/[slug]` уже был hero с cover/metadata.
2. Описание располагалось сразу под заголовком и было постоянно открыто.
3. В отдельном блоке ниже находился placeholder:
   - «В этой зоне может быть встроенный плеер…»
   - фактического embed-плеера не было.
4. Внешние ссылки, теги, community-блок и related-карточки были рабочими.
5. Phase 15 structured rendering для импортированных описаний уже работал (`ImportedDescription`).

## 2) Как реализован embedded player

### 2.1 Новая компонента плеера
- Добавлен файл: `src/components/archive/detail-media-player.tsx`.
- Логика:
  1. По текущим данным item выбирается кандидат на воспроизведение (в первую очередь `primaryLink`, затем links).
  2. Для YouTube извлекается video id из реальных URL-форматов (`watch?v=`, `youtu.be`, `shorts`, `embed`, `live`).
  3. Для Twitch собирается embed URL:
     - `videos/{id}`,
     - channel URL,
     - clips (`clips.twitch.tv`).
  4. Для Twitch учитывается `parent` домен (из request host, с fallback на site URL).
- Плеер выводится через `iframe` в `aspect-video` контейнере.

### 2.2 Поведение для unsupported cases
- Если embed-URL построить нельзя:
  - показывается безопасный fallback-медиаблок с cover/thumbnail (если есть);
  - остаётся заметный CTA на внешний источник (primary link);
  - страница не падает и не теряет контент.

## 3) Позиция плеера относительно описания
- Требование выполнено:
  - плеер размещён в hero-content зоне выше секции описания;
  - описание больше не доминирует в первом экране.

## 4) Collapsible описание

### 4.1 Новая компонента описания
- Добавлен файл: `src/components/archive/detail-description-panel.tsx`.
- Реализация через `details/summary`:
  - по умолчанию блок свернут;
  - кнопка/индикатор «Показать / Свернуть»;
  - при раскрытии показывается полный текст.

### 4.2 Сохранение Phase 15 улучшений
- Для импортированных записей внутри collapsible используется `ImportedDescription`.
- Это сохраняет:
  - структурирование абзацев;
  - обработку ссылочных/списочных фрагментов;
  - внутреннее show more/show less для очень длинных импортированных описаний.

## 5) Изменения layout detail page
- Обновлён `src/app/streams/[slug]/page.tsx`:
  1. Добавлен `DetailMediaPlayer` в верхний контентный блок (над описанием).
  2. Старый placeholder-блок плеера удалён.
  3. Описание вынесено в `DetailDescriptionPanel` в отдельную карточку.
  4. Блок внешних ссылок/тегов сохранён.
  5. Community и related блоки сохранены без логических изменений.

## 6) Что осталось неизменным намеренно
1. Не добавлялся bulk publish в admin.
2. Не добавлялась comment reputation.
3. Не выполнялся большой Pixabay-inspired UI pass.
4. Не менялась ingestion архитектура и source sync логика.
5. Не удалялись внешние ссылки и не менялся write flow community/admin.

## 7) Изменённые файлы
1. `src/components/archive/detail-media-player.tsx` (новый)
2. `src/components/archive/detail-description-panel.tsx` (новый)
3. `src/app/streams/[slug]/page.tsx`
4. `docs/ROADMAP.md`
5. `docs/reports/phase_17_media_detail_player_and_collapsible_description.md`

## 8) Команды, выполненные в ходе прохода
1. `git status --short`
2. `Get-Content src/app/streams/[slug]/page.tsx`
3. `rg -n "embed|youtube|twitch|..."`
4. `npm run lint`
5. `npm run build`

## 9) Результат проверки
- `npm run lint` — успешно.
- `npm run build` — успешно.

## 10) Неверифицировано в рамках локального прохода
1. Live-проверка embed поведения на боевом домене после deploy (особенно Twitch parent-domain в runtime).
2. Визуальная проверка на реальном production наборе ссылок (edge-cases URL-паттернов).
