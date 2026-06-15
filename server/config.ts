import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const configSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.string().optional().default("3000"),
});

const _config = configSchema.safeParse(process.env);

if (!_config.success) {
  console.error("❌ Invalid server configuration:", _config.error.format());
  throw new Error("Invalid server configuration");
}

export const config = _config.data;
