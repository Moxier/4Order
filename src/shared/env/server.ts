import "server-only";

import { z } from "zod";

import { getPublicEnvironment, type PublicEnvironment } from "@/shared/env/public";

const privateEnvironmentSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
});

export type ServerEnvironment = PublicEnvironment &
  z.infer<typeof privateEnvironmentSchema>;

let cachedEnvironment: ServerEnvironment | undefined;

export function getServerEnvironment(): ServerEnvironment {
  cachedEnvironment ??= {
    ...getPublicEnvironment(),
    ...privateEnvironmentSchema.parse({
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    }),
  };

  return cachedEnvironment;
}
