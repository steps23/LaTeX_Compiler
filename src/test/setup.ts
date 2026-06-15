import "@testing-library/jest-dom";
import { vi } from "vitest";
import "fake-indexeddb/auto"; // Use fake-indexeddb for accurate IDB tests

// Fallback for JSDOM missing DOMMatrix
if (typeof DOMMatrix === "undefined") {
  // @ts-expect-error fallback for JSDOM
  (global as typeof globalThis & { DOMMatrix: unknown }).DOMMatrix =
    class DOMMatrix {
      constructor() {}
    };
}

// Ensure Web Crypto API is available for tests (Node 19+ has it globally but just in case JSDOM messes it up)
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto as unknown as Crypto;
} else if (!globalThis.crypto.subtle) {
  Object.defineProperty(globalThis.crypto, "subtle", {
    value: webcrypto.subtle,
    writable: true,
  });
}

// Mock queryCommandSupported for Monaco in JSDOM
if (typeof document.queryCommandSupported === "undefined") {
  document.queryCommandSupported = () => false;
}

// Mock pdfjs-dist because JSDOM doesn't support DOMMatrix and canvas fully
vi.mock("pdfjs-dist", async () => {
  return {
    getDocument: vi.fn(),
    GlobalWorkerOptions: { workerSrc: "" },
    version: "2.14.0",
  };
});
