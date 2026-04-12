export function sanitizeInternalRedirect(
  candidate: string | null | undefined,
  fallback = "/",
) {
  const value = (candidate ?? "").trim();
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  return value;
}

