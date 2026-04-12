import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";

import type { CommunityWriteContext } from "@/server/auth/community-gate";
import type { CommunityIdentityMode } from "@/types/content";

const VISITOR_ID_COOKIE = "orkpod_guest_id";
const VISITOR_NAME_COOKIE = "orkpod_guest_name";
const DEFAULT_GUEST_NAME = "Гость";
const DEFAULT_AUTH_NAME = "Пользователь";

export interface CommunityIdentityContext {
  mode: CommunityIdentityMode;
  fingerprint: string;
  displayName: string;
}

function normalizeDisplayName(value: string | null | undefined, fallback: string) {
  const normalized = (value ?? "").trim().replace(/\s+/g, " ");
  if (!normalized) return fallback;
  if (normalized.length > 48) return normalized.slice(0, 48);
  return normalized;
}

function buildGuestFingerprint() {
  return `guest_${randomUUID().replace(/-/g, "")}`;
}

function deriveAuthDisplayName(email: string | null) {
  const candidate = email?.split("@")[0] ?? "";
  return normalizeDisplayName(candidate, DEFAULT_AUTH_NAME);
}

export function buildSupabaseActorFingerprint(userId: string) {
  return `supabase_user_${userId}`;
}

export async function readCommunityIdentity() {
  const store = await cookies();
  const fingerprint = store.get(VISITOR_ID_COOKIE)?.value ?? null;
  const displayName = normalizeDisplayName(store.get(VISITOR_NAME_COOKIE)?.value, DEFAULT_GUEST_NAME);

  return {
    mode: "guest_cookie_v1" as const,
    fingerprint,
    displayName,
  };
}

export async function ensureCommunityIdentity(
  preferredDisplayName?: string,
): Promise<CommunityIdentityContext> {
  const store = await cookies();
  let fingerprint = store.get(VISITOR_ID_COOKIE)?.value ?? null;

  if (!fingerprint) {
    fingerprint = buildGuestFingerprint();
    store.set(VISITOR_ID_COOKIE, fingerprint, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  const displayName = normalizeDisplayName(
    preferredDisplayName ?? store.get(VISITOR_NAME_COOKIE)?.value,
    DEFAULT_GUEST_NAME,
  );
  store.set(VISITOR_NAME_COOKIE, displayName, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });

  return {
    mode: "guest_cookie_v1",
    fingerprint,
    displayName,
  };
}

export async function resolveCommunityIdentityForWrite(params: {
  writeContext: CommunityWriteContext;
  preferredDisplayName?: string;
}): Promise<CommunityIdentityContext> {
  const { writeContext, preferredDisplayName } = params;

  if (writeContext.requiresAuth) {
    const principal = writeContext.principal;
    if (!principal) {
      throw new Error("Для community write требуется авторизованная Supabase-сессия.");
    }

    return {
      mode: "guest_cookie_v1",
      fingerprint: buildSupabaseActorFingerprint(principal.userId),
      displayName: deriveAuthDisplayName(principal.email),
    };
  }

  return ensureCommunityIdentity(preferredDisplayName);
}
