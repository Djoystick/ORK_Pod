import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabaseServiceConfig } from "@/lib/supabase/config";

export function createSupabaseServiceClient() {
  const config = getSupabaseServiceConfig();

  if (!config) {
    return null;
  }

  return createClient(config.url, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
