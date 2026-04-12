import Image from "next/image";

import { getSiteUrl } from "@/lib/seo";
import type { ResolvedContentItem } from "@/types/content";

type DetailMediaPlayerProps = {
  item: ResolvedContentItem;
  requestHost?: string | null;
};

type EmbedPayload = {
  provider: "youtube" | "twitch";
  embedUrl: string;
};

function normalizeHostForTwitchParent(rawHost?: string | null) {
  if (!rawHost) {
    return null;
  }

  const host = rawHost.trim().toLowerCase();
  if (!host) {
    return null;
  }

  return host.split(":")[0] ?? null;
}

function readFallbackParentDomain() {
  try {
    return new URL(getSiteUrl()).hostname;
  } catch {
    return "localhost";
  }
}

function extractYouTubeVideoId(parsed: URL) {
  const host = parsed.hostname.toLowerCase();

  if (host === "youtu.be") {
    const shortId = parsed.pathname.split("/").filter(Boolean)[0];
    return shortId ?? null;
  }

  if (!host.includes("youtube.com")) {
    return null;
  }

  const watchId = parsed.searchParams.get("v");
  if (watchId) {
    return watchId;
  }

  const pathSegments = parsed.pathname.split("/").filter(Boolean);
  if (pathSegments.length === 0) {
    return null;
  }

  if (pathSegments[0] === "embed" || pathSegments[0] === "shorts" || pathSegments[0] === "live") {
    return pathSegments[1] ?? null;
  }

  return null;
}

function extractTwitchEmbedUrl(parsed: URL, parentDomain: string | null) {
  if (!parentDomain) {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  const pathSegments = parsed.pathname.split("/").filter(Boolean);

  if (host === "clips.twitch.tv" && pathSegments[0]) {
    return `https://clips.twitch.tv/embed?clip=${encodeURIComponent(pathSegments[0])}&parent=${encodeURIComponent(parentDomain)}`;
  }

  if (!host.endsWith("twitch.tv")) {
    return null;
  }

  if (pathSegments[0] === "videos" && pathSegments[1]) {
    const rawVideoId = pathSegments[1].replace(/^v/i, "");
    if (!rawVideoId) {
      return null;
    }

    return `https://player.twitch.tv/?video=v${encodeURIComponent(rawVideoId)}&parent=${encodeURIComponent(parentDomain)}&autoplay=false`;
  }

  if (pathSegments[0] && pathSegments[0] !== "directory" && pathSegments[0] !== "p") {
    return `https://player.twitch.tv/?channel=${encodeURIComponent(pathSegments[0])}&parent=${encodeURIComponent(parentDomain)}&autoplay=false`;
  }

  return null;
}

function resolveEmbedPayload(item: ResolvedContentItem, requestHost?: string | null): EmbedPayload | null {
  const parentDomain = normalizeHostForTwitchParent(requestHost) ?? readFallbackParentDomain();
  const candidateLinks = item.primaryLink
    ? [item.primaryLink, ...item.links.filter((entry) => entry.url !== item.primaryLink?.url)]
    : item.links;

  for (const link of candidateLinks) {
    const rawUrl = link.url?.trim();
    if (!rawUrl) {
      continue;
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      continue;
    }

    const youtubeId = extractYouTubeVideoId(parsed);
    if (youtubeId) {
      return {
        provider: "youtube",
        embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(youtubeId)}?rel=0&modestbranding=1`,
      };
    }

    const twitchEmbedUrl = extractTwitchEmbedUrl(parsed, parentDomain);
    if (twitchEmbedUrl) {
      return {
        provider: "twitch",
        embedUrl: twitchEmbedUrl,
      };
    }
  }

  return null;
}

export function DetailMediaPlayer({ item, requestHost }: DetailMediaPlayerProps) {
  const embed = resolveEmbedPayload(item, requestHost);

  return (
    <article className="space-y-3 rounded-2xl border border-white/10 bg-black/25 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl text-zinc-100">Видео / запись</h2>
        <span className="rounded-full border border-white/20 px-2.5 py-1 text-xs uppercase tracking-[0.12em] text-zinc-300">
          {embed ? (embed.provider === "youtube" ? "YouTube Embed" : "Twitch Embed") : "Внешний источник"}
        </span>
      </div>

      {embed ? (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/60">
          <div className="relative aspect-video">
            <iframe
              src={embed.embedUrl}
              title={`Плеер: ${item.title}`}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        </div>
      ) : (
        <div
          className="relative overflow-hidden rounded-2xl border border-dashed border-white/20 bg-black/35"
          style={{
            backgroundImage: `linear-gradient(135deg, ${item.cover.palette[0]}, ${item.cover.palette[1]})`,
          }}
        >
          {item.cover.kind === "image" && item.cover.src ? (
            <Image
              src={item.cover.src}
              alt={item.cover.alt || item.title}
              fill
              sizes="(max-width: 1024px) 100vw, 900px"
              className="object-cover object-center"
            />
          ) : null}
          <div className="relative z-10 bg-black/55 p-6 text-center text-zinc-200">
            <p className="text-sm">
              Встроенный плеер для этого источника недоступен. Откройте запись по внешней ссылке.
            </p>
          </div>
        </div>
      )}

      {item.primaryLink ? (
        <a
          href={item.primaryLink.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center rounded-xl bg-emerald-300 px-4 text-sm font-semibold text-[#062515] transition hover:bg-emerald-200"
        >
          {item.primaryLink.label}
        </a>
      ) : null}
    </article>
  );
}
