import "@testing-library/jest-dom";
import { vi } from "vitest";
import "fake-indexeddb/auto"; // Use fake-indexeddb for accurate IDB tests

// Fallback for JSDOM missing DOMMatrix
if (typeof DOMMatrix === "undefined") {
  Object.defineProperty(globalThis, "DOMMatrix", {
    value: class DOMMatrix {
      constructor() {}
    },
    writable: true,
  });
}

// Ensure Web Crypto API is available for tests (Node 19+ has it globally but just in case JSDOM messes it up)
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    writable: true,
  });
} else if (!globalThis.crypto.subtle) {
  Object.defineProperty(globalThis.crypto, "subtle", {
    value: webcrypto.subtle,
    writable: true,
  });
}

// Mock browser APIs Monaco expects in JSDOM
if (typeof document.queryCommandSupported === "undefined") {
  document.queryCommandSupported = () => false;
}

if (typeof window.matchMedia === "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// Mock pdfjs-dist because JSDOM doesn't support DOMMatrix and canvas fully
vi.mock("pdfjs-dist", async () => {
  return {
    getDocument: vi.fn(),
    GlobalWorkerOptions: { workerSrc: "" },
    version: "2.14.0",
  };
});
