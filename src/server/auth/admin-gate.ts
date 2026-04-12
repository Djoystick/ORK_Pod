import "server-only";

import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { resolveSupabasePrincipal, type SupabaseAuthPrincipal } from "@/server/auth/supabase-auth";
import { allowBootstrapAdminInProduction } from "@/server/config/runtime-safety";

export type AuthStrategy = "local_bootstrap" | "supabase_auth";
export type AdminGateMode = "disabled" | "local_dev" | "bootstrap_key" | "supabase_auth";
export type AdminMatchSource = "allowlist" | "admin_users";

export interface AdminGateContext {
  strategy: AuthStrategy;
  mode: AdminGateMode;
  canAccessAdmin: boolean;
  requiresKeyForWrites: boolean;
  requiresSupabaseAuth: boolean;
  message: string;
  principal: SupabaseAuthPrincipal | null;
  adminMatchSource?: AdminMatchSource;
}

type AdminUsersLookupResult = {
  matched: boolean;
  tableChecked: boolean;
  error?: string;
};

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

function isAdminPrincipalInAllowlist(principal: SupabaseAuthPrincipal | null) {
  if (!principal) {
    return {
      matched: false,
      configured: false,
    };
  }

  const allowedEmailsRaw = parseCsvSet(process.env.ADMIN_ALLOWED_EMAILS);
  const allowedUserIds = parseCsvSet(process.env.ADMIN_ALLOWED_USER_IDS);
  const allowedEmails = new Set(Array.from(allowedEmailsRaw).map((entry) => entry.toLowerCase()));
  const configured = allowedEmails.size > 0 || allowedUserIds.size > 0;

  if (!configured) {
    return {
      matched: false,
      configured: false,
    };
  }

  if (principal.email && allowedEmails.has(principal.email.toLowerCase())) {
    return {
      matched: true,
      configured: true,
    };
  }

  return {
    matched: allowedUserIds.has(principal.userId),
    configured: true,
  };
}

async function lookupAdminUserByPrincipal(
  principal: SupabaseAuthPrincipal | null,
): Promise<AdminUsersLookupResult> {
  if (!principal) {
    return {
      matched: false,
      tableChecked: false,
    };
  }

  const client = createSupabaseServiceClient();
  if (!client) {
    return {
      matched: false,
      tableChecked: false,
      error: "Supabase service client is not configured.",
    };
  }

  const result = await client
    .from("admin_users")
    .select("id")
    .eq("user_id", principal.userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (result.error) {
    return {
      matched: false,
      tableChecked: false,
      error: result.error.message,
    };
  }

  return {
    matched: Boolean(result.data?.id),
    tableChecked: true,
  };
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
  const allowlistMatch = isAdminPrincipalInAllowlist(principal);
  const adminUsersLookup = await lookupAdminUserByPrincipal(principal);

  const matchedByAllowlist = allowlistMatch.matched;
  const matchedByAdminUsers = adminUsersLookup.matched;
  const adminLookupConfigured = allowlistMatch.configured || adminUsersLookup.tableChecked;

  if (!principal) {
    return {
      strategy,
      mode: "disabled",
      canAccessAdmin: false,
      requiresKeyForWrites: false,
      requiresSupabaseAuth: true,
      principal: null,
      message: adminLookupConfigured
        ? "Supabase auth mode: требуется валидная пользовательская сессия. Без нее admin write paths недоступны."
        : "Supabase auth mode: требуется сессия, и должен быть настроен хотя бы один admin lookup (env allowlist или таблица admin_users).",
    };
  }

  if (matchedByAllowlist) {
    return {
      strategy,
      mode: "supabase_auth",
      canAccessAdmin: true,
      requiresKeyForWrites: false,
      requiresSupabaseAuth: true,
      principal,
      adminMatchSource: "allowlist",
      message:
        "Supabase auth mode: доступ подтвержден через ADMIN_ALLOWED_EMAILS/ADMIN_ALLOWED_USER_IDS.",
    };
  }

  if (matchedByAdminUsers) {
    return {
      strategy,
      mode: "supabase_auth",
      canAccessAdmin: true,
      requiresKeyForWrites: false,
      requiresSupabaseAuth: true,
      principal,
      adminMatchSource: "admin_users",
      message:
        "Supabase auth mode: доступ подтвержден через таблицу admin_users (is_active=true).",
    };
  }

  if (!adminLookupConfigured) {
    return {
      strategy,
      mode: "disabled",
      canAccessAdmin: false,
      requiresKeyForWrites: false,
      requiresSupabaseAuth: true,
      principal,
      message: adminUsersLookup.error
        ? `Admin lookup не готов: ${adminUsersLookup.error}`
        : "Admin lookup не настроен: заполните ADMIN_ALLOWED_EMAILS/ADMIN_ALLOWED_USER_IDS или добавьте запись в admin_users.",
    };
  }

  return {
    strategy,
    mode: "disabled",
    canAccessAdmin: false,
    requiresKeyForWrites: false,
    requiresSupabaseAuth: true,
    principal,
    message:
      "Пользователь аутентифицирован, но не найден в ADMIN_ALLOWED_* и не имеет активной записи в admin_users.",
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

