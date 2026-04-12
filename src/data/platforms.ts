import type { Platform } from "@/types/content";

export const platforms: Platform[] = [
  {
    id: "platform-youtube",
    slug: "youtube",
    title: "YouTube",
    kind: "video",
    baseUrl: "https://youtube.com",
  },
  {
    id: "platform-twitch",
    slug: "twitch",
    title: "Twitch",
    kind: "stream",
    baseUrl: "https://twitch.tv",
  },
  {
    id: "platform-vk-video",
    slug: "vk-video",
    title: "VK Видео",
    kind: "video",
    baseUrl: "https://vkvideo.ru",
  },
  {
    id: "platform-telegram",
    slug: "telegram",
    title: "Telegram",
    kind: "social",
    baseUrl: "https://t.me",
  },
];
