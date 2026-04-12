import "server-only";

export function getSupabaseAccessTokenCookieName() {
  return process.env.ORKPOD_SUPABASE_ACCESS_TOKEN_COOKIE?.trim() || "orkpod_supabase_access_token";
}

export function getSupabaseRefreshTokenCookieName() {
  return (
    process.env.ORKPOD_SUPABASE_REFRESH_TOKEN_COOKIE?.trim() ||
    "orkpod_supabase_refresh_token"
  );
}

