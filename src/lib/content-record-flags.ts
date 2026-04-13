import type { ContentItem } from "@/types/content";

const legacyDemoSlugPrefixes = [
  "inside-stream-",
  "retro-air-",
  "live-build-",
  "qna-room-",
  "archive-notes-",
  "tooling-lab-",
];

export function isLegacyDemoContentItem(item: ContentItem) {
  const sourceType = item.sourceType?.trim().toLowerCase();
  if (sourceType === "manual" || sourceType === "imported") {
    return false;
  }

  const idLooksLegacy = /^item-\d{3}$/i.test(item.id.trim());
  if (!idLooksLegacy) {
    return false;
  }

  const slug = item.slug.trim().toLowerCase();
  return legacyDemoSlugPrefixes.some((prefix) => slug.startsWith(prefix));
}
