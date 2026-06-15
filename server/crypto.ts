import crypto from "crypto";
import { config } from "./config";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypts a string (e.g. stringified JSON of tokens) using AES-256-GCM.
 * Assumes config.ENCRYPTION_KEY is a 32-character string.
 */
export function encryptTokenData(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(config.ENCRYPTION_KEY, "utf-8"),
    iv,
  );

  let encrypted = cipher.update(text, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encryptedData (all base64)
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`;
}

/**
 * Decrypts data encrypted by encryptTokenData.
 */
export function decryptTokenData(encryptedData: string): string {
  const parts = encryptedData.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format");
  }

  const iv = Buffer.from(parts[0], "base64");
  const authTag = Buffer.from(parts[1], "base64");
  const encryptedText = parts[2];

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(config.ENCRYPTION_KEY, "utf-8"),
    iv,
  );
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedText, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
