import type { ContentItem } from "@/types/content";

export const contentItems: ContentItem[] = [
  {
    id: "item-001",
    slug: "inside-stream-editorial-pipeline",
    title: "Inside Stream: редакторский пайплайн записи эфиров",
    seriesId: "series-inside-stream",
    platformId: "platform-youtube",
    tagIds: ["tag-editorial", "tag-process", "tag-archive"],
    publishedAt: "2026-02-16",
    durationMinutes: 62,
    excerpt:
      "Как команда собирает запись из сырого эфира в аккуратный архивный выпуск.",
    description:
      "Выпуск про полный цикл: от пост-стрим заметок до финального карточного оформления в каталоге. Разобрали, что ускоряет выпуск и где чаще всего ломается консистентность описаний.",
    cover: {
      kind: "gradient",
      alt: "Редакционная схема выпуска",
      palette: ["#1E3A8A", "#0F172A"],
    },
    links: [
      {
        kind: "youtube",
        label: "Смотреть на YouTube",
        url: "https://youtube.com/watch?v=orkpod001",
      },
    ],
    featured: true,
  },
  {
    id: "item-002",
    slug: "retro-air-multi-platform-recap",
    title: "Retro Air: мультиплатформенная публикация без дублирования ручной работы",
    seriesId: "series-retro-air",
    platformId: "platform-vk-video",
    tagIds: ["tag-analytics", "tag-process", "tag-automation"],
    publishedAt: "2026-01-28",
    durationMinutes: 49,
    excerpt:
      "Разбор подхода к публикации на YouTube, VK Видео и Telegram с единым шаблоном.",
    description:
      "Пошагово разобрали, как разделить обязательные поля карточки и платформенные особенности, чтобы редколлегия не вела несколько разных версий описания.",
    cover: {
      kind: "gradient",
      alt: "Сетка платформ и метаданных",
      palette: ["#334155", "#020617"],
    },
    links: [
      {
        kind: "vk_video",
        label: "Открыть в VK Видео",
        url: "https://vkvideo.ru/video-orkpod002",
      },
    ],
    featured: true,
  },
  {
    id: "item-003",
    slug: "live-build-nextjs-archive-grid",
    title: "Live Build: архивная сетка на Next.js App Router",
    seriesId: "series-live-build",
    platformId: "platform-youtube",
    tagIds: ["tag-nextjs", "tag-typescript", "tag-ux"],
    publishedAt: "2025-12-18",
    durationMinutes: 87,
    excerpt:
      "Собрали адаптивную сетку карточек для каталога с акцентом на быстрый обзор.",
    description:
      "Практический выпуск: проектируем логику карточек, выносим повторяющиеся элементы и показываем, как масштабировать структуру под десятки серий.",
    cover: {
      kind: "gradient",
      alt: "Интерфейс каталога на тёмном фоне",
      palette: ["#0F766E", "#022C22"],
    },
    links: [
      {
        kind: "youtube",
        label: "Смотреть выпуск",
        url: "https://youtube.com/watch?v=orkpod003",
      },
      {
        kind: "docs",
        label: "Таймкоды и заметки",
        url: "https://t.me/orkpod/3003",
      },
    ],
    featured: true,
  },
  {
    id: "item-004",
    slug: "qna-room-search-vs-navigation",
    title: "Q&A Room: когда поиск важнее меню навигации",
    seriesId: "series-qna-room",
    platformId: "platform-telegram",
    tagIds: ["tag-community", "tag-ux", "tag-archive"],
    publishedAt: "2025-11-27",
    durationMinutes: 41,
    excerpt:
      "Вопросы аудитории о discoverability и сценариях первого посещения архива.",
    description:
      "Обсуждаем, почему пользователь сначала ищет знакомый фрагмент, а не читает рубрикатор целиком. Добавили критерии для главной страницы и приоритезацию блоков.",
    cover: {
      kind: "gradient",
      alt: "Q&A с вопросами сообщества",
      palette: ["#7C3AED", "#1F2937"],
    },
    links: [
      {
        kind: "telegram",
        label: "Пост с ответами",
        url: "https://t.me/orkpod/314",
      },
    ],
  },
  {
    id: "item-005",
    slug: "archive-notes-audio-recovery",
    title: "Archive Notes: восстановление звука в старых записях",
    seriesId: "series-archive-notes",
    platformId: "platform-vk-video",
    tagIds: ["tag-audio", "tag-archive", "tag-process"],
    publishedAt: "2025-10-20",
    durationMinutes: 34,
    excerpt:
      "Короткий выпуск о том, как переиздать старый эфир без полной пересборки.",
    description:
      "Показали прагматичный процесс: минимальная чистка шума, корректировка громкости, обновление обложки и прозрачное описание изменений в карточке.",
    cover: {
      kind: "gradient",
      alt: "Визуал аудио-дорожки",
      palette: ["#92400E", "#1F2937"],
    },
    links: [
      {
        kind: "vk_video",
        label: "Смотреть запись",
        url: "https://vkvideo.ru/video-orkpod005",
      },
    ],
  },
  {
    id: "item-006",
    slug: "tooling-lab-obs-scene-templates",
    title: "Tooling Lab: шаблоны сцен OBS для серийных эфиров",
    seriesId: "series-tooling-lab",
    platformId: "platform-twitch",
    tagIds: ["tag-obs", "tag-streaming", "tag-process"],
    publishedAt: "2025-09-14",
    durationMinutes: 73,
    excerpt:
      "Настраиваем единый пресет сцен, чтобы ускорить запуск стрима и архивирование.",
    description:
      "Разобрали базовую схему сцен и naming policy для ассетов, чтобы после эфира автоматически собирать корректные метаданные в архив.",
    cover: {
      kind: "gradient",
      alt: "Набор сцен для стриминга",
      palette: ["#0EA5E9", "#1E1B4B"],
    },
    links: [
      {
        kind: "twitch",
        label: "Запись на Twitch",
        url: "https://twitch.tv/videos/orkpod006",
      },
    ],
  },
  {
    id: "item-007",
    slug: "inside-stream-metrics-that-matter",
    title: "Inside Stream: метрики, которые помогают редакции, а не пугают",
    seriesId: "series-inside-stream",
    platformId: "platform-youtube",
    tagIds: ["tag-analytics", "tag-editorial", "tag-process"],
    publishedAt: "2025-08-03",
    durationMinutes: 58,
    excerpt:
      "Обсуждаем минимальный набор метрик для отбора записей на переупаковку.",
    description:
      "Сравнили просмотры, удержание и возвраты в каталог. Показали, как связать эти сигналы с конкретными решениями по названию, обложке и позиционированию выпуска.",
    cover: {
      kind: "gradient",
      alt: "Панель аналитики контента",
      palette: ["#166534", "#0F172A"],
    },
    links: [
      {
        kind: "youtube",
        label: "Открыть выпуск",
        url: "https://youtube.com/watch?v=orkpod007",
      },
    ],
  },
  {
    id: "item-008",
    slug: "retro-air-thumbnail-language",
    title: "Retro Air: визуальный язык обложек для длинных серий",
    seriesId: "series-retro-air",
    platformId: "platform-youtube",
    tagIds: ["tag-ux", "tag-editorial", "tag-archive"],
    publishedAt: "2025-07-22",
    durationMinutes: 46,
    excerpt:
      "Система обложек, где каждая серия узнается за секунду в общей сетке архива.",
    description:
      "Построили правило: общее ядро + модульные отличия по рубрике. Рассмотрели кейсы, когда обложка красиво выглядит отдельно, но теряется в каталоге.",
    cover: {
      kind: "gradient",
      alt: "Макеты обложек серий",
      palette: ["#9333EA", "#0F172A"],
    },
    links: [
      {
        kind: "youtube",
        label: "Смотреть разбор",
        url: "https://youtube.com/watch?v=orkpod008",
      },
    ],
  },
  {
    id: "item-009",
    slug: "live-build-search-and-filters",
    title: "Live Build: поиск и фильтры для каталога стримов",
    seriesId: "series-live-build",
    platformId: "platform-youtube",
    tagIds: ["tag-nextjs", "tag-typescript", "tag-archive"],
    publishedAt: "2025-06-11",
    durationMinutes: 92,
    excerpt:
      "Реализуем клиентские фильтры по платформе, рубрике и серии без потери скорости.",
    description:
      "Собрали рабочую модель фильтрации и сортировки. Отдельно обсудили, как подготовить такой слой для будущего перехода на БД без переписывания UI.",
    cover: {
      kind: "gradient",
      alt: "Поиск в архиве",
      palette: ["#0369A1", "#111827"],
    },
    links: [
      {
        kind: "youtube",
        label: "Смотреть лайв",
        url: "https://youtube.com/watch?v=orkpod009",
      },
      {
        kind: "docs",
        label: "Исходные заметки",
        url: "https://t.me/orkpod/409",
      },
    ],
    featured: true,
  },
  {
    id: "item-010",
    slug: "qna-room-archive-taxonomy",
    title: "Q&A Room: как не сломать таксономию каталога через полгода",
    seriesId: "series-qna-room",
    platformId: "platform-telegram",
    tagIds: ["tag-community", "tag-archive", "tag-process"],
    publishedAt: "2025-05-19",
    durationMinutes: 38,
    excerpt:
      "Ответы про нормализацию рубрик, тегов и привязок к внешним площадкам.",
    description:
      "Выпуск для команды, которая начинает архив с локальных файлов. Обсудили, какие поля должны быть стабильными при миграции на внешнее хранилище.",
    cover: {
      kind: "gradient",
      alt: "Схема таксономии контента",
      palette: ["#4C1D95", "#0B1120"],
    },
    links: [
      {
        kind: "telegram",
        label: "Читать Q&A",
        url: "https://t.me/orkpod/287",
      },
    ],
  },
  {
    id: "item-011",
    slug: "archive-notes-recut-episode",
    title: "Archive Notes: пересборка выпуска из двух старых эфиров",
    seriesId: "series-archive-notes",
    platformId: "platform-vk-video",
    tagIds: ["tag-archive", "tag-editorial", "tag-audio"],
    publishedAt: "2025-04-14",
    durationMinutes: 29,
    excerpt:
      "Кейс по склейке двух эфиров в единый материал для каталожной серии.",
    description:
      "Разобрали сценарий с разными форматами источников и разным качеством звука. Показали, как корректно зафиксировать происхождение материала в описании.",
    cover: {
      kind: "gradient",
      alt: "Сборка выпуска из архивных фрагментов",
      palette: ["#475569", "#0F172A"],
    },
    links: [
      {
        kind: "vk_video",
        label: "Открыть итоговый выпуск",
        url: "https://vkvideo.ru/video-orkpod011",
      },
    ],
  },
  {
    id: "item-012",
    slug: "tooling-lab-auto-notes",
    title: "Tooling Lab: автоматические show-notes для карточек архива",
    seriesId: "series-tooling-lab",
    platformId: "platform-twitch",
    tagIds: ["tag-automation", "tag-streaming", "tag-typescript"],
    publishedAt: "2025-03-08",
    durationMinutes: 65,
    excerpt:
      "Собираем черновик описания из таймкодов и внутренних заметок продюсера.",
    description:
      "Показали прототип генерации структуры карточки: заголовок, краткое описание, ссылки и теги. Подход рассчитан на последующую проверку редактором.",
    cover: {
      kind: "gradient",
      alt: "Автоматизация карточек",
      palette: ["#065F46", "#052E16"],
    },
    links: [
      {
        kind: "twitch",
        label: "Запись лаборатории",
        url: "https://twitch.tv/videos/orkpod012",
      },
    ],
  },
  {
    id: "item-013",
    slug: "inside-stream-host-rotation",
    title: "Inside Stream: ротация ведущих и узнаваемость формата",
    seriesId: "series-inside-stream",
    platformId: "platform-youtube",
    tagIds: ["tag-process", "tag-community", "tag-editorial"],
    publishedAt: "2025-02-21",
    durationMinutes: 52,
    excerpt:
      "Как менять ведущих в серии и не терять узнаваемость каталожного продукта.",
    description:
      "Обсудили роль структуры эпизода, неизменных блоков и речевого темпа. Добавили практические рекомендации для карточек выпуска и трейлерных фрагментов.",
    cover: {
      kind: "gradient",
      alt: "Ведущие и формат выпуска",
      palette: ["#9F1239", "#1F2937"],
    },
    links: [
      {
        kind: "youtube",
        label: "Смотреть интервью",
        url: "https://youtube.com/watch?v=orkpod013",
      },
    ],
  },
  {
    id: "item-014",
    slug: "live-build-detail-page-pattern",
    title: "Live Build: паттерн детальной страницы записи",
    seriesId: "series-live-build",
    platformId: "platform-youtube",
    tagIds: ["tag-nextjs", "tag-ux", "tag-archive"],
    publishedAt: "2025-01-30",
    durationMinutes: 78,
    excerpt:
      "Проектируем detail-страницу: контекст, ссылки, related-контент и читаемость.",
    description:
      "Собрали структуру страницы записи для архива: медиазона, метаданные, внешние ссылки и блок похожих выпусков, чтобы пользователь продолжал просмотр.",
    cover: {
      kind: "gradient",
      alt: "Детальная страница медиа-записи",
      palette: ["#1D4ED8", "#111827"],
    },
    links: [
      {
        kind: "youtube",
        label: "Смотреть выпуск",
        url: "https://youtube.com/watch?v=orkpod014",
      },
      {
        kind: "docs",
        label: "Конспект структуры",
        url: "https://t.me/orkpod/255",
      },
    ],
  },
];
