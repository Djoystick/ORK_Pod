import "server-only";

function parseBoolean(value: string | undefined, defaultValue: boolean) {
  if (value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  return defaultValue;
}

export function isProductionRuntime() {
  return process.env.NODE_ENV === "production";
}

export function allowFallbackInProduction() {
  return parseBoolean(process.env.ALLOW_FALLBACK_IN_PRODUCTION, false);
}

export function allowSupabaseErrorFallbackInProduction() {
  return parseBoolean(process.env.ALLOW_FALLBACK_ON_SUPABASE_ERROR_IN_PRODUCTION, false);
}

export function allowBootstrapAdminInProduction() {
  return parseBoolean(process.env.ALLOW_BOOTSTRAP_ADMIN_IN_PRODUCTION, false);
}
