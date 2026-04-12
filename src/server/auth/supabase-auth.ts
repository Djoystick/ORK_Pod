import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getSupabaseAccessTokenCookieName } from "@/server/auth/supabase-session-cookies";

export interface SupabaseAuthPrincipal {
  userId: string;
  email: string | null;
}

export interface SupabaseAuthResolution {
  principal: SupabaseAuthPrincipal | null;
  source: "cookie_token";
  error?: string;
}

const resolveSupabasePrincipalCached = cache(async (): Promise<SupabaseAuthResolution> => {
  const client = createSupabaseServiceClient();
  if (!client) {
    return {
      principal: null,
      source: "cookie_token",
      error: "Supabase service client is not configured.",
    };
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(getSupabaseAccessTokenCookieName())?.value?.trim();
  if (!token) {
    return {
      principal: null,
      source: "cookie_token",
      error: "Supabase access token cookie is missing.",
    };
  }

  const result = await client.auth.getUser(token);
  if (result.error || !result.data.user) {
    return {
      principal: null,
      source: "cookie_token",
      error: result.error?.message ?? "Supabase user session is invalid.",
    };
  }

  return {
    principal: {
      userId: result.data.user.id,
      email: result.data.user.email ?? null,
    },
    source: "cookie_token",
  };
});

export async function resolveSupabasePrincipal() {
  return resolveSupabasePrincipalCached();
}
