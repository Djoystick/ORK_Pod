"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { sanitizeInternalRedirect } from "@/lib/redirect";
import {
  getSupabaseAccessTokenCookieName,
  getSupabaseRefreshTokenCookieName,
} from "@/server/auth/supabase-session-cookies";

export type SignInActionState = {
  status: "idle" | "success" | "error";
  message: string;
  redirectTo?: string;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function getStringValue(formData: FormData, field: string) {
  return String(formData.get(field) ?? "").trim();
}

async function setSessionCookies({
  accessToken,
  refreshToken,
  expiresIn,
}: {
  accessToken: string;
  refreshToken?: string | null;
  expiresIn?: number | null;
}) {
  const store = await cookies();
  const secure = process.env.NODE_ENV === "production";
  const accessCookie = getSupabaseAccessTokenCookieName();
  const refreshCookie = getSupabaseRefreshTokenCookieName();

  store.set(accessCookie, accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: expiresIn && expiresIn > 0 ? expiresIn : 60 * 60,
  });

  if (refreshToken) {
    store.set(refreshCookie, refreshToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
}

export async function signInAction(
  _prevState: SignInActionState,
  formData: FormData,
): Promise<SignInActionState> {
  const email = normalizeEmail(getStringValue(formData, "email"));
  const password = getStringValue(formData, "password");
  const nextPath = sanitizeInternalRedirect(getStringValue(formData, "next"), "/");

  if (!email || !password) {
    return {
      status: "error",
      message: "Укажите email и пароль.",
    };
  }

  const supabaseConfig = getSupabasePublicConfig();
  if (!supabaseConfig) {
    return {
      status: "error",
      message:
        "Supabase auth не настроен: отсутствуют NEXT_PUBLIC_SUPABASE_URL или NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    };
  }

  const authClient = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const result = await authClient.auth.signInWithPassword({
    email,
    password,
  });

  if (result.error || !result.data.session?.access_token) {
    return {
      status: "error",
      message: result.error?.message ?? "Не удалось выполнить вход. Проверьте учетные данные.",
    };
  }

  await setSessionCookies({
    accessToken: result.data.session.access_token,
    refreshToken: result.data.session.refresh_token,
    expiresIn: result.data.session.expires_in,
  });

  revalidatePath("/");
  revalidatePath("/streams");
  revalidatePath("/admin");

  return {
    status: "success",
    message: "Вход выполнен. Перенаправляем...",
    redirectTo: nextPath,
  };
}

export async function signOutAction(formData: FormData) {
  const nextPath = sanitizeInternalRedirect(getStringValue(formData, "redirectTo"), "/");
  const store = await cookies();

  store.delete(getSupabaseAccessTokenCookieName());
  store.delete(getSupabaseRefreshTokenCookieName());

  revalidatePath("/");
  revalidatePath("/streams");
  revalidatePath("/admin");

  redirect(nextPath);
}
