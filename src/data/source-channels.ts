import type { SourceChannel } from "@/types/content";

export const sourceChannels: SourceChannel[] = [
  {
    id: "channel-youtube-orkcut",
    slug: "orkcut",
    title: "orkcut",
    platformId: "platform-youtube",
    externalChannelId: "@orkcut",
    sourceUrl: "https://www.youtube.com/@orkcut/videos",
    isActive: true,
    notes: "Первый обязательный канал для будущего ingestion.",
  },
  {
    id: "channel-youtube-orkstream",
    slug: "orkstream",
    title: "orkstream",
    platformId: "platform-youtube",
    externalChannelId: "@orkstream",
    sourceUrl: "https://www.youtube.com/@orkstream/videos",
    isActive: true,
    notes: "Второй обязательный канал для будущего ingestion.",
  },
  {
    id: "channel-youtube-orkpod",
    slug: "orkpod-youtube",
    title: "ORKPOD YouTube",
    platformId: "platform-youtube",
    externalChannelId: "UCPZZring891k7JVnr70dlIw",
    sourceUrl: "https://youtube.com/@orkpod",
    isActive: true,
    notes: "Канал новостных и аналитических выпусков ORKPOD.",
  },
];
