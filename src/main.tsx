import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Suppress harmless ResizeObserver errors globally (preserves standard logging)
if (typeof window !== "undefined") {
  const _ResizeObserver = window.ResizeObserver;
  window.ResizeObserver = class ResizeObserver extends _ResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      super((entries, observer) => {
        window.requestAnimationFrame(() => {
          try {
            callback(entries, observer);
          } catch (e) {
            // Ignore
          }
        });
      });
    }
  };

  window.addEventListener("error", (e) => {
    if (
      e.message &&
      (e.message.includes("ResizeObserver") ||
        e.message.includes("undelivered notifications"))
    ) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
