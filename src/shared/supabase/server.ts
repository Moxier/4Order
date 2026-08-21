import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getPublicEnvironment } from "@/shared/env/public";
import type { Database } from "@/shared/supabase/database.generated";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const environment = getPublicEnvironment();

  return createServerClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot write response cookies. `src/proxy.ts`
            // performs refreshes; Server Actions and Route Handlers can write.
          }
        },
      },
    },
  );
}
