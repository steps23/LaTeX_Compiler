# ADR 0002: Tauri 2 Desktop Foundation

## Status
Accepted

## Context
The application needs to be distributed as a native desktop application for macOS Apple Silicon (`aarch64-apple-darwin`), while retaining the React 19 / Vite SPA as the primary UI layer. The requirements dictate moving from a purely web-based application (using `BrowserRouter`) to a dual-runtime mode, accommodating both browser-based web preview and Tauri-based desktop packaging.

## Decision
1. **Tauri v2 Initialization**: We initialized Tauri v2 specifically targeting Apple Silicon macOS, configuring the application identifier to `it.stefanoruggiero.texforge`.
2. **HashRouter Adoption**: Changed `BrowserRouter` to `HashRouter` to prevent blank pages on refresh or direct file opening. Tauri intercepts file-based protocol paths (`tauri://localhost/*`), which can disrupt `BrowserRouter` nested route resolution.
3. **Runtime Adapter**: Implemented `src/utils/runtime.ts` encapsulating the `isTauri` check using `window.__TAURI_INTERNALS__`. This allows seamless conditional rendering without polluting components.
4. **Least Privilege Capabilities**: Initialized minimal capabilities via `src-tauri/capabilities/default.json` giving access to `dialog`, `window-state`, `process`, and `opener`. We did not grant global filesystem access or arbitrary shell capabilities to the frontend.
5. **IPC Setup**: Implemented a harmless initialization command `get_runtime_info` in Rust to handle foundational IPC messaging.

## Consequences
- The web app works seamlessly in browser mode for previewing and development.
- The Tauri desktop app securely boots into a dedicated native macOS window with session state restoration.
- Future desktop integrations (like native `sqlite`, `latexmk` invocation) are unblocked and isolated behind typed IPC interfaces.
