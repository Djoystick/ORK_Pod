import "server-only";

import { resolveSupabasePrincipal, type SupabaseAuthPrincipal } from "@/server/auth/supabase-auth";
import { allowBootstrapAdminInProduction } from "@/server/config/runtime-safety";

export type AuthStrategy = "local_bootstrap" | "supabase_auth";
export type AdminGateMode = "disabled" | "local_dev" | "bootstrap_key" | "supabase_auth";

export interface AdminGateContext {
  strategy: AuthStrategy;
  mode: AdminGateMode;
  canAccessAdmin: boolean;
  requiresKeyForWrites: boolean;
  requiresSupabaseAuth: boolean;
  message: string;
  principal: SupabaseAuthPrincipal | null;
}

function isLocalHost(host: string) {
  return host.includes("localhost") || host.includes("127.0.0.1");
}

function parseCsvSet(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

function getAuthStrategy(): AuthStrategy {
  const raw = process.env.ORKPOD_AUTH_STRATEGY?.trim();
  if (raw === "supabase_auth" || raw === "local_bootstrap") {
    return raw;
  }

  return process.env.NODE_ENV === "production" ? "supabase_auth" : "local_bootstrap";
}

function isAllowedInLocalDev(host: string) {
  const allowLocal = process.env.ALLOW_LOCAL_DEV_ADMIN?.trim();
  const allow = allowLocal ? allowLocal === "true" : true;
  return allow && process.env.NODE_ENV !== "production" && isLocalHost(host);
}

function isAdminPrincipalAllowed(principal: SupabaseAuthPrincipal | null) {
  if (!principal) return false;

  const allowedEmails = parseCsvSet(process.env.ADMIN_ALLOWED_EMAILS);
  const allowedUserIds = parseCsvSet(process.env.ADMIN_ALLOWED_USER_IDS);

  if (allowedEmails.size === 0 && allowedUserIds.size === 0) {
    return false;
  }

  if (principal.email && allowedEmails.has(principal.email.toLowerCase())) {
    return true;
  }

  return allowedUserIds.has(principal.userId);
}

export async function resolveAdminGateContext(host: string): Promise<AdminGateContext> {
  const strategy = getAuthStrategy();

  if (strategy === "local_bootstrap") {
    if (process.env.NODE_ENV === "production" && !allowBootstrapAdminInProduction()) {
      return {
        strategy,
        mode: "disabled",
        canAccessAdmin: false,
        requiresKeyForWrites: false,
        requiresSupabaseAuth: false,
        principal: null,
        message:
          "local_bootstrap отключен в production по policy. Используйте ORKPOD_AUTH_STRATEGY=supabase_auth.",
      };
    }

    const hasBootstrapKey = Boolean(process.env.ADMIN_BOOTSTRAP_KEY);

    if (isAllowedInLocalDev(host)) {
      return {
        strategy,
        mode: "local_dev",
        canAccessAdmin: true,
        requiresKeyForWrites: false,
        requiresSupabaseAuth: false,
        principal: null,
        message:
          "Локальный dev-admin режим включен. Это удобно для разработки, но не является production-safe auth.",
      };
    }

    if (hasBootstrapKey) {
      return {
        strategy,
        mode: "bootstrap_key",
        canAccessAdmin: true,
        requiresKeyForWrites: true,
        requiresSupabaseAuth: false,
        principal: null,
        message:
          "Bootstrap admin mode: для write-операций требуется ADMIN_BOOTSTRAP_KEY. Используйте только как временный fallback.",
      };
    }

    return {
      strategy,
      mode: "disabled",
      canAccessAdmin: false,
      requiresKeyForWrites: false,
      requiresSupabaseAuth: false,
      principal: null,
      message:
        "Admin-доступ отключен. Для fallback режима задайте ADMIN_BOOTSTRAP_KEY или включите локальный dev-admin режим.",
    };
  }

  const supabaseAuth = await resolveSupabasePrincipal();
  const principal = supabaseAuth.principal;
  const isAllowed = isAdminPrincipalAllowed(principal);
  const allowlistConfigured =
    parseCsvSet(process.env.ADMIN_ALLOWED_EMAILS).size > 0 ||
    parseCsvSet(process.env.ADMIN_ALLOWED_USER_IDS).size > 0;

  if (!allowlistConfigured) {
    return {
      strategy,
      mode: "disabled",
      canAccessAdmin: false,
      requiresKeyForWrites: false,
      requiresSupabaseAuth: true,
      principal,
      message:
        "Supabase auth mode активен, но не задан admin allowlist (ADMIN_ALLOWED_EMAILS/ADMIN_ALLOWED_USER_IDS). Admin write paths заблокированы.",
    };
  }

  if (!principal) {
    return {
      strategy,
      mode: "disabled",
      canAccessAdmin: false,
      requiresKeyForWrites: false,
      requiresSupabaseAuth: true,
      principal: null,
      message:
        "Supabase auth mode: требуется валидная пользовательская сессия. Без нее admin write paths недоступны.",
    };
  }

  if (!isAllowed) {
    return {
      strategy,
      mode: "disabled",
      canAccessAdmin: false,
      requiresKeyForWrites: false,
      requiresSupabaseAuth: true,
      principal,
      message: "Пользователь Supabase аутентифицирован, но не входит в admin allowlist.",
    };
  }

  return {
    strategy,
    mode: "supabase_auth",
    canAccessAdmin: true,
    requiresKeyForWrites: false,
    requiresSupabaseAuth: true,
    principal,
    message:
      "Supabase auth mode: доступ подтвержден по allowlist. Это основной production-направленный путь для admin write-операций.",
  };
}

export async function assertAdminWriteAccess({
  host,
  providedKey,
}: {
  host: string;
  providedKey?: string;
}) {
  const gate = await resolveAdminGateContext(host);

  if (!gate.canAccessAdmin) {
    throw new Error("Admin write access denied.");
  }

  if (!gate.requiresKeyForWrites) {
    return gate;
  }

  if (!providedKey || providedKey !== process.env.ADMIN_BOOTSTRAP_KEY) {
    throw new Error("Неверный bootstrap ключ.");
  }

  return gate;
}
