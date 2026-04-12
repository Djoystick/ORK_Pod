import type { ContentItem, CoverAsset, ExternalLink } from "@/types/content";

const DEFAULT_FALLBACK_PALETTE: [string, string] = ["#1D4ED8", "#0F172A"];

function isLikelyYouTubeVideoId(value: string | null | undefined) {
  if (!value) return false;
  return /^[a-zA-Z0-9_-]{11}$/.test(value.trim());
}

function extractYouTubeVideoIdFromUrl(url: string) {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  if (host === "youtu.be") {
    return parsed.pathname.split("/").filter(Boolean)[0] ?? null;
  }

  if (!host.includes("youtube.com")) {
    return null;
  }

  const watchId = parsed.searchParams.get("v");
  if (watchId) {
    return watchId;
  }

  const path = parsed.pathname.split("/").filter(Boolean);
  if (path[0] === "shorts" || path[0] === "embed" || path[0] === "live") {
    return path[1] ?? null;
  }

  return null;
}

function findYouTubeThumbnailCandidate(
  links: ExternalLink[],
  externalSourceId: string | null | undefined,
) {
  for (const link of links) {
    const candidateId = extractYouTubeVideoIdFromUrl(link.url);
    if (isLikelyYouTubeVideoId(candidateId)) {
      return `https://i.ytimg.com/vi/${candidateId}/hqdefault.jpg`;
    }
  }

  if (isLikelyYouTubeVideoId(externalSourceId)) {
    return `https://i.ytimg.com/vi/${externalSourceId}/hqdefault.jpg`;
  }

  return null;
}

export function resolveContentItemCover(item: ContentItem): CoverAsset {
  const palette =
    Array.isArray(item.cover?.palette) &&
    item.cover.palette.length === 2 &&
    item.cover.palette.every((entry) => typeof entry === "string" && entry.trim().length > 0)
      ? (item.cover.palette as [string, string])
      : DEFAULT_FALLBACK_PALETTE;
  const alt = item.cover?.alt?.trim() || item.title;
  const currentSrc = item.cover?.src?.trim() || undefined;
  const currentKind = item.cover?.kind === "image" ? "image" : "gradient";

  if (currentKind === "image" && currentSrc) {
    return {
      kind: "image",
      alt,
      palette,
      src: currentSrc,
    };
  }

  const derivedThumbnail = findYouTubeThumbnailCandidate(
    item.links ?? [],
    item.externalSourceId ?? null,
  );
  if (derivedThumbnail) {
    return {
      kind: "image",
      alt,
      palette,
      src: derivedThumbnail,
    };
  }

  return {
    kind: "gradient",
    alt,
    palette,
  };
}
