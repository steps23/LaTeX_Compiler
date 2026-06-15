import { describe, it, expect } from "vitest";
import {
  computeTextHash,
  computeBlobHash,
  generateStableId,
} from "../src/utils/crypto";

describe("Crypto Utilities", () => {
  it("should compute accurate text hash", async () => {
    const hash = await computeTextHash("hello world");
    // Expected SHA-256 for "hello world"
    expect(hash).toBe(
      "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
    );
  });

  it("should compute accurate blob hash", async () => {
    const text = "hello blob";
    const blob = new Blob([text]);
    const hashText = await computeTextHash(text);
    const hashBlob = await computeBlobHash(blob);
    expect(hashBlob).toBe(hashText);
  });

  it("should generate stable id", () => {
    expect(generateStableId("prefix", "a b")).toBe("prefix_a%20b");
  });
});
