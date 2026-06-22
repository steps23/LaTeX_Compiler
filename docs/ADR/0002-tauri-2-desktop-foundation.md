# ADR 0002: Tauri 2 Cross-Platform Foundation

## Status

Accepted.

## Context

TeXForge needs one React/Vite UI for browser preview and native Tauri webviews on macOS, Windows and Linux. Evidence from one operating system must not be promoted to cross-platform support.

## Decision

1. Target `aarch64-apple-darwin`, `x86_64-apple-darwin`, `x86_64-pc-windows-msvc` and `x86_64-unknown-linux-gnu` from shared code.
2. Use `HashRouter` so direct editor routes and refreshes do not depend on server fallback behavior.
3. Start Vite directly for `tauri:dev`; retain Express only as an isolated browser workflow.
4. Put runtime detection and IPC behind `src/utils/runtime.ts`. Contract version 1 exposes runtime, app version, OS, architecture and target family and validates unknown responses.
5. Keep only the official window-state plugin. The main capability grants `core:default`; no filesystem, shell, process, opener or dialog access is available.
6. Use separate production and development CSPs. Production permits local bundled assets, blob workers and Tauri IPC, with no localhost or remote asset origin.
7. Build and test each initial target on a native CI runner. A CI build is build evidence only, not an installed-app or real-machine test.

## Consequences

- Browser and desktop modes share UI behavior without making desktop startup depend on Express.
- New native functions require explicit typed commands, capability review and platform evidence.
- `unsafe-eval` remains in `script-src` for current Monaco compatibility and `unsafe-inline` remains in `style-src` for current styling; both are documented residual CSP constraints.
- Filesystem, SQLite, local TeX, packaging and release support remain outside Prompt 3.
