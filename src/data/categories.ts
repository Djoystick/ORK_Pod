import type { Category } from "@/types/content";

export const categories: Category[] = [
  {
    id: "cat-interview",
    slug: "interview",
    title: "Интервью",
    description:
      "Беседы с авторами, разработчиками и гостями про процессы, решения и закулисье продакшена.",
  },
  {
    id: "cat-analysis",
    slug: "analysis",
    title: "Аналитика",
    description:
      "Разборы эфиров и выпусков: структура, подача, техника, динамика и выводы для команды.",
  },
  {
    id: "cat-practice",
    slug: "practice",
    title: "Практика",
    description:
      "Лайв-сессии, где мы собираем реальные решения в прямом эфире и фиксируем результат.",
  },
  {
    id: "cat-community",
    slug: "community",
    title: "Сообщество",
    description:
      "Открытые Q&A, экспериментальные форматы и обсуждения с аудиторией.",
  },
];
