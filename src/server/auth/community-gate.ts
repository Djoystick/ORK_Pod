import "server-only";

import { resolveSupabasePrincipal, type SupabaseAuthPrincipal } from "@/server/auth/supabase-auth";

export type CommunityWriteMode = "guest_local" | "supabase_auth_required";

export interface CommunityWriteContext {
  mode: CommunityWriteMode;
  canWrite: boolean;
  requiresAuth: boolean;
  principal: SupabaseAuthPrincipal | null;
  message: string;
}

function getConfiguredMode(): CommunityWriteMode {
  const raw = process.env.ORKPOD_COMMUNITY_WRITE_MODE?.trim();
  if (raw === "guest_local" || raw === "supabase_auth_required") {
    return raw;
  }

  const authStrategy = process.env.ORKPOD_AUTH_STRATEGY?.trim();
  if (authStrategy === "supabase_auth" || process.env.NODE_ENV === "production") {
    return "supabase_auth_required";
  }

  return "guest_local";
}

export async function resolveCommunityWriteContext(): Promise<CommunityWriteContext> {
  const mode = getConfiguredMode();

  if (mode === "guest_local") {
    const allowGuestInProd = process.env.ALLOW_GUEST_COMMUNITY_WRITES_IN_PROD === "true";
    const inProd = process.env.NODE_ENV === "production";
    if (inProd && !allowGuestInProd) {
      return {
        mode,
        canWrite: false,
        requiresAuth: false,
        principal: null,
        message:
          "Guest community writes отключены в production-режиме. Включите Supabase auth write path.",
      };
    }

    return {
      mode,
      canWrite: true,
      requiresAuth: false,
      principal: null,
      message:
        "Локальный режим community write: guest identity разрешена только для dev/fallback сценариев.",
    };
  }

  const resolved = await resolveSupabasePrincipal();
  if (!resolved.principal) {
    return {
      mode,
      canWrite: false,
      requiresAuth: true,
      principal: null,
      message:
        "Для community write требуется Supabase-аутентификация. Гостевые write-path отключены.",
    };
  }

  return {
    mode,
    canWrite: true,
    requiresAuth: true,
    principal: resolved.principal,
    message: "Community write доступен через Supabase-аутентифицированную сессию.",
  };
}

export async function assertCommunityWriteAccess() {
  const context = await resolveCommunityWriteContext();
  if (!context.canWrite) {
    throw new Error(context.message);
  }

  return context;
}
