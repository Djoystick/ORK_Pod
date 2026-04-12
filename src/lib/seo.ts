const DEFAULT_LOCAL_SITE_URL = "http://localhost:3000";
const DEFAULT_SOCIAL_IMAGE_PATH = "/branding/background.webp";

function normalizeSiteUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export function getSiteUrl() {
  const envCandidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
  ];

  for (const entry of envCandidates) {
    if (!entry) continue;
    const normalized = normalizeSiteUrl(entry);
    if (normalized) return normalized;
  }

  return DEFAULT_LOCAL_SITE_URL;
}

export function getSiteMetadataBase() {
  return new URL(getSiteUrl());
}

export function toAbsoluteSiteUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, getSiteUrl()).toString();
}

export function getDefaultSocialImageUrl() {
  return toAbsoluteSiteUrl(DEFAULT_SOCIAL_IMAGE_PATH);
}

export function getSocialImageUrl(candidate?: string | null) {
  if (!candidate) {
    return getDefaultSocialImageUrl();
  }

  if (candidate.startsWith("http://") || candidate.startsWith("https://")) {
    return candidate;
  }

  return toAbsoluteSiteUrl(candidate);
}

export function pickMetaDescription(...parts: Array<string | null | undefined>) {
  for (const part of parts) {
    const normalized = part?.trim();
    if (normalized) {
      return normalized.slice(0, 260);
    }
  }

  return "Архив стримов и выпусков ORKPOD с удобной навигацией, фильтрами и деталями по записям.";
}
