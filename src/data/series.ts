import type { Series } from "@/types/content";

export const seriesList: Series[] = [
  {
    id: "series-inside-stream",
    slug: "inside-stream",
    categoryId: "cat-interview",
    title: "Inside Stream",
    description:
      "Интервью о производстве контента, ролях в команде и технической кухне.",
  },
  {
    id: "series-retro-air",
    slug: "retro-air",
    categoryId: "cat-analysis",
    title: "Retro Air",
    description:
      "Пост-эфирные разборы с фокусом на структуру, ритм и удержание внимания.",
  },
  {
    id: "series-live-build",
    slug: "live-build",
    categoryId: "cat-practice",
    title: "Live Build",
    description:
      "Практические стримы с реальной задачей и ограниченным временем.",
  },
  {
    id: "series-qna-room",
    slug: "qna-room",
    categoryId: "cat-community",
    title: "Q&A Room",
    description:
      "Открытый формат вопросов и ответов с короткими прикладными демо.",
  },
  {
    id: "series-archive-notes",
    slug: "archive-notes",
    categoryId: "cat-analysis",
    title: "Archive Notes",
    description:
      "Короткие выпуски с заметками по старым записям и повторным выводам.",
  },
  {
    id: "series-tooling-lab",
    slug: "tooling-lab",
    categoryId: "cat-practice",
    title: "Tooling Lab",
    description:
      "Серии по инструментам и рабочим пайплайнам для стрим-команды.",
  },
];
