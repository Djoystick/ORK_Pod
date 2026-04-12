# Phase 16 — SEO / Performance / Indexing Foundation

## 1) Стартовое состояние (фактически)
1. Публичные страницы `/`, `/streams`, `/streams/[slug]`, `/about` работали, но SEO-слой был базовым:
   - metadata ограничивались в основном `title/description`;
   - canonical/OG/Twitter были неполными и не везде детерминированными;
   - detail metadata не использовали полноценно поля контента.
2. Не было metadata-route для:
   - `robots.txt`;
   - `sitemap.xml`.
3. Structured data отсутствовали на публичных страницах.
4. Private indexing boundary не был явно зафиксирован через robots/metadata (`/admin`, `/auth`).
5. По image SEO/readiness:
   - у контента уже были cover/thumbnail данные в модели;
   - на public UI карточки/hero в основном использовали градиенты без реального thumbnail-рендера.
6. В `getStreamDetailData` был лишний дублированный data access path (два обращения к published items).

## 2) Изменения по metadata (public foundation)

### 2.1 Базовый layout-level SEO
- Обновлён `src/app/layout.tsx`:
  - добавлен `metadataBase` (через общий SEO helper);
  - добавлены `alternates.canonical`, `openGraph`, `twitter`, базовый `robots`;
  - сохранены текущие title template и branding icons.

### 2.2 Home `/`
- Обновлён `src/app/page.tsx`:
  - добавлены `title`, `description`, `canonical`, OG, Twitter;
  - description и social image строятся детерминированно (без фиктивных полей).

### 2.3 Archive `/streams`
- Обновлён `src/app/streams/page.tsx`:
  - переведено на `generateMetadata` с учётом search params;
  - canonical закреплён на `/streams`;
  - для фильтрованных/поисковых URL включён `noindex,follow` для снижения индекс-ловушек;
  - для базового архива — `index,follow`.

### 2.4 Detail `/streams/[slug]`
- Обновлён `src/app/streams/[slug]/page.tsx`:
  - `generateMetadata` использует реальные поля item (title/excerpt/description/tags/category/platform/cover);
  - добавлены canonical, OG, Twitter, keywords;
  - для несуществующего slug в metadata выставлен `noindex`.

### 2.5 About `/about`
- Обновлён `src/app/about/page.tsx`:
  - canonical, OG, Twitter на уровне страницы.

## 3) Indexing rails: robots + sitemap

### 3.1 `robots.txt`
- Добавлен `src/app/robots.ts`.
- Правила:
  - public: `Allow: /`;
  - private: `Disallow: /admin`, `/admin/`, `/auth`, `/auth/`;
  - добавлен `Sitemap` URL.

### 3.2 `sitemap.xml`
- Добавлен `src/app/sitemap.ts`.
- Включены:
  - статические public URL: `/`, `/streams`, `/about`;
  - detail URL опубликованных items (`/streams/[slug]`).
- Для detail entries добавлены `lastModified`, `changeFrequency`, `priority`, а также `images` (если есть cover image).
- Добавлен безопасный fallback: при ошибке repository маршрут возвращает хотя бы static routes, а не падает полностью.
- Добавлен `dynamic = "force-dynamic"` и `revalidate = 3600`, чтобы sitemap не ломал build при отсутствии прод-конфига и не застывал навсегда.

## 4) Structured data (практично и по данным)
1. Home (`src/app/page.tsx`): `WebSite` + `SearchAction` (поиск по архиву).
2. Streams (`src/app/streams/page.tsx`): `CollectionPage`.
3. About (`src/app/about/page.tsx`): `AboutPage`.
4. Detail (`src/app/streams/[slug]/page.tsx`): `VideoObject` (name/description/thumbnail/uploadDate/duration/url/publisher/contentUrl).

Надстройка не использует выдуманные поля: только данные из текущей модели контента.

## 5) Image / thumbnail SEO readiness
1. Обновлён `src/components/archive/archive-card.tsx`:
   - карточки теперь рендерят `cover.src` через `next/image` при наличии;
   - добавлены корректные `alt` и `sizes`;
   - fallback-градIENT сохранён.
2. Обновлён detail hero в `src/app/streams/[slug]/page.tsx`:
   - при наличии `cover.src` рендерится оптимизированное изображение (`next/image`) с `alt`.
3. Обновлён `next.config.ts`:
   - добавлены `images.remotePatterns` для YouTube thumbnail-доменов;
   - включены modern image formats (`avif`, `webp`).

## 6) Узкий performance-pass
1. Обновлён `src/server/services/public-content-service.ts`:
   - в `getStreamDetailData` устранено двойное чтение published items;
   - detail item и related теперь рассчитываются от одного списка.
2. Побочный эффект SEO/perf:
   - metadata/detail path использует тот же оптимизированный сервисный путь.

## 7) Private indexing safety
1. Обновлён `src/app/admin/layout.tsx`:
   - добавлен `robots: noindex,nofollow,nocache`.
2. Обновлён `src/app/auth/sign-in/page.tsx`:
   - добавлен `robots: noindex,nofollow,nocache`.
3. В `robots.txt` private пути также явно disallow.

## 8) Файлы, изменённые в фазе
1. `src/lib/seo.ts` (новый)
2. `src/app/layout.tsx`
3. `src/app/page.tsx`
4. `src/app/streams/page.tsx`
5. `src/app/streams/[slug]/page.tsx`
6. `src/app/about/page.tsx`
7. `src/app/robots.ts` (новый)
8. `src/app/sitemap.ts` (новый)
9. `src/components/archive/archive-card.tsx`
10. `src/server/services/public-content-service.ts`
11. `src/app/admin/layout.tsx`
12. `src/app/auth/sign-in/page.tsx`
13. `next.config.ts`
14. `docs/ROADMAP.md`
15. `docs/reports/phase_16_seo_performance_indexing_foundation.md`

## 9) Команды, выполненные в ходе прохода
1. `rg --files src/app`
2. `rg -n "export const metadata|generateMetadata|robots|sitemap|..."`
3. `Get-Content ...` (аудит layout/public/admin/auth/service/config)
4. `rg -n "<img|next/image|Image" ...`
5. `npm run lint`
6. `npm run build` (первый прогон с ошибкой на prerender `/sitemap.xml`)
7. Правка `src/app/sitemap.ts` (dynamic fallback)
8. `npm run build` (успешно)
9. `npm run lint` (финальный успешный прогон)

## 10) Результат сборки
- `npm run lint` — успешно.
- `npm run build` — успешно после фикса sitemap-prerender path.

## 11) Что намеренно не менялось (non-goals)
1. Не добавлялся embedded player.
2. Не добавлялся collapsible/spoiler блок описания.
3. Не реализован admin bulk publish.
4. Не реализована comment reputation.
5. Не делался крупный Pixabay-inspired UI pass.
6. Не менялась ingestion-архитектура/YouTube automation логика вне SEO/perf/indexing scope.

## 12) Что остаётся для следующих фаз
1. Пост-деплой live-проверка индексации (факт обхода robots/sitemap внешними ботами).
2. Дальнейшие cover improvements как отдельный продуктовый блок.
3. Embedded player + collapsible description на detail pages.
4. Admin bulk publish для publish-ready queue.
5. Comment reputation system.
6. Крупный UI pass (Pixabay-inspired) отдельной фазой.
