"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getPublicEnvironment } from "@/shared/env/public";
import type { Database } from "@/shared/supabase/database.generated";

export function createBrowserSupabaseClient() {
  const environment = getPublicEnvironment();

  return createBrowserClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
