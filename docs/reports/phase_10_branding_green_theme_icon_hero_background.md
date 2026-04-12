# Phase 10 — Branding pass: green ork theme + icon + hero background

## 1. Цель прохода
Сделать узкий визуальный проход без расширения продуктового scope:
1. Интегрировать локальный `icon.jpg` в брендинг.
2. Применить `background.webp` строго к главному hero-блоку на Home.
3. Перевести акцентную визуальную систему в зеленую ork-направленность.
4. Сохранить читаемость, dark-доминантный стиль и рабочие live-флоу.

## 2. Фактический стартовый визуальный контекст
1. Public/live логика уже рабочая (auth/admin/community/ingestion).
2. Текущий public shell использовал холодные cyan/indigo акценты.
3. В header был текстовый бренд-маркер без использования предоставленного `icon.jpg`.
4. Home hero был на градиентном фоне без подключения `background.webp`.
5. Основные CTA и фокус-состояния на public-страницах были преимущественно бело/cyan.

## 3. Интеграция обязательных локальных ассетов
Источник:
1. `H:\Work\ORKpod\item\icon.jpg`
2. `H:\Work\ORKpod\item\background.webp`

Выполнено:
1. Создана папка `public/branding`.
2. Ассеты скопированы:
   - `public/branding/icon.jpg`
   - `public/branding/background.webp`
3. Пути выбраны так, чтобы одинаково работать локально и в деплое (статическая раздача Next.js из `public`).

## 4. Где применен icon
1. `src/components/layout/site-header.tsx`
   - иконка встроена в brand-mark в header через `next/image`.
2. `src/app/layout.tsx`
   - добавлены `metadata.icons` (`icon`, `shortcut`, `apple`) с путем `/branding/icon.jpg`.

## 5. Где применен hero background
1. `src/app/page.tsx`
   - `background.webp` применен только в крупном верхнем hero-блоке Home.
   - добавлены 2 overlay-слоя (gradient + radial tint) для контраста и читаемости текста/формы.
   - фон не применялся глобально к другим страницам.

## 6. Что изменено в green-теме (узко по public shell)

### 6.1 Глобальная база/атмосфера
1. `src/app/globals.css`
   - смещены базовые dark-цвета и фоновые радиальные акценты в зеленую гамму.
   - обновлен цвет `::selection` под green palette.

2. `src/components/layout/site-shell.tsx`
   - фоновые blur/glow-слои переведены в emerald/green/lime оттенки.

### 6.2 Header / навигация / primary actions
1. `src/components/layout/site-header.tsx`
   - бренд с иконкой,
   - активный nav-pill теперь зеленый,
   - sign-in button и hover-акценты переведены в зеленую палитру,
   - сохранены существующие auth/admin-индикаторы.

### 6.3 Home hero и discovery CTA
1. `src/app/page.tsx`
   - hero caption/CTA переведены в green accent,
   - кнопка «Открыть архив» зеленая,
   - поле поиска с emerald focus.

### 6.4 Public pages / cards / controls / community
1. `src/app/streams/page.tsx`
2. `src/app/about/page.tsx`
3. `src/app/streams/[slug]/page.tsx`
4. `src/components/archive/archive-card.tsx`
5. `src/components/archive/archive-controls.tsx`
6. `src/components/home/category-overview.tsx`
7. `src/components/community/community-block.tsx`
8. `src/app/auth/sign-in/page.tsx`
9. `src/app/auth/sign-in/sign-in-form.tsx`
10. `src/app/not-found.tsx`

В этих файлах:
1. Обновлены наиболее заметные public accent surfaces (кнопки, focus, hover/active, ссылки, чипы).
2. Сохранена исходная структура и функциональные сценарии.

## 7. Что намеренно НЕ менялось
1. Не менялась backend-логика (auth/admin/community/ingestion/moderation).
2. Не изменялись SQL/Supabase/миграции.
3. Не делался агрессивный редизайн IA или layout-архитектуры.
4. Не менялись бизнес-правила комментариев/реакций.

## 8. Команды, выполненные в проходе
1. Аудит структуры и текущих entry points:
   - `rg --files ...`
   - `Get-Content ...` по key visual файлам.
2. Копирование ассетов:
   - `New-Item -ItemType Directory -Path public/branding -Force`
   - `Copy-Item item/icon.jpg public/branding/icon.jpg`
   - `Copy-Item item/background.webp public/branding/background.webp`
3. Проверки:
   - `npm run lint`
   - `npm run build`

## 9. Результаты проверок
1. `npm run lint` — успешно.
2. `npm run build` — успешно.
3. Маршруты public/auth/admin присутствуют в build output.
4. Ассеты доступны в `public/branding`.

## 10. Итог по acceptance
1. `icon.jpg` интегрирован в брендинг и metadata icons.
2. `background.webp` применен к hero-блоку Home с защитой читаемости.
3. Основной акцентный язык public-интерфейса смещен в green ork-направление.
4. Dark premium база и рабочие live-флоу сохранены.
