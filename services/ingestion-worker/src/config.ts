import { z } from "zod";

const envSchema = z.object({
  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  
  // X API
  X_BEARER_TOKEN: z.string().min(1),
  
  // Internal webhook
  WEBHOOK_URL: z.string().url(),
  INTERNAL_WEBHOOK_SECRET: z.string().min(1),
  
  // Optional
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  RECONNECT_DELAY_MS: z.coerce.number().default(5000),
  MAX_RECONNECT_ATTEMPTS: z.coerce.number().default(10),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(): Config {
  const result = envSchema.safeParse({
    SUPABASE_URL: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    X_BEARER_TOKEN: process.env.X_BEARER_TOKEN,
    WEBHOOK_URL: process.env.WEBHOOK_URL || "https://x-sentiments.vercel.app",
    INTERNAL_WEBHOOK_SECRET: process.env.INTERNAL_WEBHOOK_SECRET,
    LOG_LEVEL: process.env.LOG_LEVEL,
    RECONNECT_DELAY_MS: process.env.RECONNECT_DELAY_MS,
    MAX_RECONNECT_ATTEMPTS: process.env.MAX_RECONNECT_ATTEMPTS,
  });

  if (!result.success) {
    console.error("Invalid configuration:", result.error.format());
    process.exit(1);
  }

  return result.data;
}

