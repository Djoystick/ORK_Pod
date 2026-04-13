import type { Category } from "@/types/content";

export const categories: Category[] = [
  {
    id: "cat-interview",
    slug: "interview",
    title: "Разговорные выпуски",
    description:
      "Длинные форматы с обсуждениями, гостями и контекстом вокруг стрим-контента.",
  },
  {
    id: "cat-analysis",
    slug: "analysis",
    title: "Новости и разборы",
    description:
      "Новости индустрии, аналитические сюжеты и редакторские разборы по игровым темам.",
  },
  {
    id: "cat-practice",
    slug: "practice",
    title: "Нарезки и хайлайты",
    description:
      "Короткие динамичные нарезки с яркими моментами, челленджами и игровыми эпизодами.",
  },
  {
    id: "cat-community",
    slug: "community",
    title: "Стримы и кооп",
    description:
      "Полные эфиры, дуэты и кооперативные прохождения с участием сообщества.",
  },
];
