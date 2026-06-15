# Current State Audit

## Overview

This audit evaluates the current TeXForge repository to determine its readiness for migration to an offline-first macOS Apple Silicon desktop app using Tauri v2. The initial baseline remediation is now **COMPLETED**.

## Codebase Status & Test Results (Final Baseline)

- **Build**: Passes successfully (`npm run build`). Generates Vite output and bundles Express server cleanly.
- **Typecheck**: Passes successfully (`npx tsc --noEmit`) with `"strict": true`. `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` were deemed too invasive for this phase.
- **Tests**: Passed (`npx vitest run`). All tests completed successfully.
  - Added specific robust testing for Monaco editor view states and disposables.
  - Correctly mocked JSDOM limitations (`document.queryCommandSupported`, `DOMMatrix`) cleanly without `@ts-expect-error` or `any`.
  - The remaining 4 `as unknown as` casts in tests (`RepoMock`, `Project`, etc.) are explicitly documented and kept as standard practice for partial mock objects.
- **Lint**: Passes successfully (`npx eslint`).
  - No `eslint-disable` used anywhere in the codebase to bypass `useEffect` limitations (Dashboard suppression removed).
  - All hooks follow exhaustive dependency rules.
- **Format**: Prettier enforcement active across the entire repository.

## Components & Architecture Readiness

- **Monaco Editor**: Converted to fully local execution. The Vite configurations and Typescript declarations (`vite-env.d.ts`) were added to type the `?worker` imports natively without `@ts-expect-error`.
- **View States**: Fixed Monaco view state loop, restoring only on file change.
- **Object URLs**: Preview for binary files moved into a dedicated `BlobViewer` component keyed by file, dynamically revoking URLs gracefully upon unmount safely. No `Promise.resolve().then` tricks applied.
- **PDF Viewer**: Lifecycle and unmount handling for `pdfjsLib` rewritten to properly clean up old states and tasks synchronously without `Promise` bypasses.

## Next Steps

The frontend code hygiene baseline is fully established. The app is ready to transition to the Tauri v2 Desktop scaffolding (Prompt 1).
