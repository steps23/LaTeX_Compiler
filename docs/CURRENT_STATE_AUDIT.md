# Current State Audit

## Overview

This audit evaluates the current TeXForge repository to determine its readiness for migration to an offline-first macOS Apple Silicon desktop app using Tauri v2.

## Codebase Status & Test Results

- **Build**: Passes successfully (`npm run build`). Generates Vite output and bundles Express server.
- **Typecheck**: Failed (`npx tsc --noEmit`). Two errors found:
  - `server/auth.ts(72,5): error TS2322: Type '"S256"' is not assignable to type 'CodeChallengeMethod'.`
  - `src/features/editor/MonacoEditor.tsx(67,31): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'ICodeEditorViewState'.`
- **Tests**: Passed (`npx vitest run`). All 28 tests across 11 files completed successfully in ~25.4s.
- **Lint**: Failed (`npx eslint src/`). 1 error and 17 warnings.
  - _Error_: `react-hooks/set-state-in-effect` in `src/components/AuthStatus.tsx` line 41.
  - _Warnings_: Multiple unused imports/variables throughout the application, specifically Lucide icons and try-catch variables.

## Component Analysis

### `package.json` & Configuration

- **TypeScript**: Configured correctly, but type errors exist in the codebase.
- **Vite & esbuild**: Used for building SPA and bundling the server. Vite runs smooth.
- **ESLint & Vitest**: Integrated, but ESLint fails due to effect/state management and unused variables.
- **Dependencies**: Uses `express`, `idb`, `lucide-react`, `pdfjs-dist`, `zustand`, `@monaco-editor/react`.

### `server/` Directory

- Contains Express backend serving API endpoints (`/api/compile` proxy to `https://texlive.net/cgi-bin/latexcgi`).
- Authentication endpoints structure is present, but `server/auth.ts` has a typcheck error regarding OAuth code challenge methods.
- The `server/` acts as an intermediary or local server for development and proxying, relying significantly on an external cloud fallback.

### Frontend Features (`src/features`, `src/components`)

- **Editor**: Uses `@monaco-editor/react`. Types need adjusting for editor state.
- **Compiler Abstract**: `HttpFallbackCompiler.ts` proxies compilation to an external service. No local WASM parsing or Rust sidecar compilation is active.
- **PDF Viewer**: Uses `pdfjs-dist` to render URLs or byte arrays.
- **FileTree**: Displays project structures, but contains unused variables according to lint.

### State & Database (`src/state`, `src/db`, `src/services`)

- **Database**: IndexedDB (`idb`) handles local persistence. It implements soft deletes and sync queues intended for Google Drive integration (`syncQueue`, `syncConflicts`), which are currently unused.
- **State**: Managed via Zustand. Full CRUD on projects/files is operational, persisting locally to IDB. Wait-based debouncer commits file changes.

## Documentation Analysis

- **README / ARCHITECTURE**: Emphasizes a web-first/Google Drive approach. Mentions "guest-mode offline persistence" via IndexedDB. Mentions WASM engine placeholders, but they are not implemented, relying purely on the HTTP fallback.
- **Limitations**: SyncTeX is marked as not available from the HTTP compilation fallback.

## Desktop / Offline Limitations & Security Risks

1. **Compilation Engine**: Heavily relies on `texlive.net` HTTP API. Offline mode cannot compile PDFs currently.
2. **Missing Local Engine**: No TeXLive / latexmk integration locally.
3. **Database Limitations**: IndexedDB is browser-bound. For a desktop app, an SQLite file-based approach (via Rust) is far more stable, accessible, and backup-friendly.
4. **Security Risks**: Express server CORS proxies. For a Tauri desktop app, Node.js server goes away; we need Rust-based HTTP requests or local binaries instead.

## Next Steps

Address the typecheck and lint issues before starting the migration. Establish the Tauri scaffolding and configure a local Rust-based `SQLite` database and `texlab` sidecar.
