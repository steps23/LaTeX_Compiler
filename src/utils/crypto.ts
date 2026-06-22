/**
 * Computes a SHA-256 hash formatted as a hex string for the given text.
 */
export async function computeTextHash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Computes a SHA-256 hash formatted as a hex string for the given Blob.
 */
export async function computeBlobHash(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generates a stable identifier based on a prefix and a string.
 */
export function generateStableId(prefix: string, identifier: string): string {
  // We can't synchronously do SHA-256 with Web Crypto without polyfill,
  // but let's base it on simple encoding or uuid if we just want uniqueness.
  // Actually, Web Crypto is async. To be "stable", we don't need crypto.
  // This helps mapping a project + path to a unique ID predictably if needed.
  return `${prefix}_${encodeURIComponent(identifier)}`;
}
