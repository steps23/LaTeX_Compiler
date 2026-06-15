import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const configSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.string().optional().default("3000"),
  OAUTH_CLIENT_ID: z.string().default("dummy_client_id"),
  OAUTH_CLIENT_SECRET: z.string().default("dummy_client_secret"),
  OAUTH_REDIRECT_URI: z.string().url().optional(),
  ENCRYPTION_KEY: z
    .string()
    .length(32)
    .default("01234567890123456789012345678901"), // 32 bytes for AES-256
  CREDENTIAL_STORE_TYPE: z
    .enum(["memory", "local", "firestore"])
    .default("memory"),
  GCP_PROJECT_ID: z.string().optional(),
});

const _config = configSchema.safeParse(process.env);

if (!_config.success) {
  console.error("❌ Invalid server configuration:", _config.error.format());
  throw new Error("Invalid server configuration");
}

export const config = _config.data;
