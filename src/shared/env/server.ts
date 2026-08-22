import "server-only";

import { z } from "zod";

import { getPublicEnvironment, type PublicEnvironment } from "@/shared/env/public";

const privateEnvironmentSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  TRUST_PROXY_HEADERS: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  TRUSTED_APP_ORIGINS: z
    .string()
    .min(1, "TRUSTED_APP_ORIGINS must list at least one exact public origin")
    .transform((value, context) => {
      const origins = value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);

      if (origins.length === 0) {
        context.addIssue({
          code: "custom",
          message: "TRUSTED_APP_ORIGINS must list at least one exact public origin",
        });
        return z.NEVER;
      }

      for (const origin of origins) {
        try {
          const parsed = new URL(origin);
          if (
            parsed.origin !== origin ||
            (parsed.protocol !== "http:" && parsed.protocol !== "https:")
          ) {
            throw new Error("not an exact HTTP origin");
          }
        } catch {
          context.addIssue({
            code: "custom",
            message: `TRUSTED_APP_ORIGINS contains an invalid origin: ${origin}`,
          });
          return z.NEVER;
        }
      }

      return origins;
    }),
});

export type ServerEnvironment = PublicEnvironment &
  z.infer<typeof privateEnvironmentSchema>;

let cachedEnvironment: ServerEnvironment | undefined;

export function getServerEnvironment(): ServerEnvironment {
  cachedEnvironment ??= {
    ...getPublicEnvironment(),
    ...privateEnvironmentSchema.parse({
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      TRUST_PROXY_HEADERS: process.env.TRUST_PROXY_HEADERS,
      TRUSTED_APP_ORIGINS: process.env.TRUSTED_APP_ORIGINS,
    }),
  };

  return cachedEnvironment;
}
