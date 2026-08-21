import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getServerEnvironment } from "@/shared/env/server";
import type { Database } from "@/shared/supabase/database.generated";

export function createServiceSupabaseClient() {
  const environment = getServerEnvironment();

  return createClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
}
