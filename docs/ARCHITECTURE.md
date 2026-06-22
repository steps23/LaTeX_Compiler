# Architecture Overview

## Runtime Boundary

TeXForge has one React 19/Vite UI and two runtime modes:

- browser preview: Express (`npm run dev`) or direct Vite (`npm run web:dev`);
- desktop: Tauri 2 loads the direct Vite server in development and bundled Vite assets in production.

Desktop startup does not depend on `server.ts` or Express. `HashRouter` keeps dashboard and editor routes stable under Tauri protocols and browser refreshes.

`src/utils/runtime.ts` is the frontend runtime boundary. It returns contract version 1 with `runtime`, `appVersion`, `os`, `arch` and `targetFamily`, validates unknown IPC payloads, and provides a browser response without IPC. Components use `RuntimeBadge`; they do not inspect Tauri globals directly.

`src/utils/storage.ts` is the storage capability introspection boundary. Browser mode reports IndexedDB. Tauri mode calls `get_storage_info`, validates a versioned IPC payload, and resolves an app-owned project storage root under the platform app data directory.

`src/utils/texRuntime.ts` is the TeX runtime diagnostic boundary. Browser mode returns a non-native diagnostic. Tauri mode calls `detect_tex_runtimes`, validates contract version 1, and exposes detected TeX Live, MacTeX or MiKTeX tools to the LaTeX Environment screen without exposing shell execution to the frontend.

`src/db/repository.ts` selects the persistence adapter at runtime: browser mode uses IndexedDB, while Tauri mode uses `src/db/nativeRepository.ts`. The native adapter calls typed IPC commands for projects and files. Rust stores project metadata as JSON, file metadata in a manifest, and project files under the app-owned `projects/<project-id>/files` tree.

## Native Boundary

`src-tauri/src/lib.rs` exposes runtime/storage introspection, TeX runtime diagnostics plus bounded project-storage commands: `detect_tex_runtimes`, `get_all_projects`, `get_project`, `save_project`, `delete_project`, `get_project_files`, `get_file`, `save_file` and `delete_file`. All native storage is constrained to Tauri's app data directory. Project IDs and project-relative paths are validated before disk access. No global filesystem permission, database, compiler process or generic shell command exists.

`src-tauri/src/tex_runtime.rs` probes process `PATH` and known platform TeX bin directories. It canonicalizes candidate executable paths, runs only allowlisted TeX binaries with separated `--version` arguments, applies a timeout and output cap, and returns diagnostics. It does not scan whole disks, mutate system PATH, install packages, invoke `sudo`, or compile user projects.

The only native plugin is `tauri-plugin-window-state`. It restores position, dimensions and maximized state while Tauri handles invalid/off-screen state. No frontend permission for that plugin is needed because the UI calls none of its commands.

The main capability grants only `core:default`. Production CSP allows bundled resources, blob workers and Tauri IPC; localhost and Vite HMR are present only in `devCsp`. Monaco requires `script-src 'unsafe-eval'`, and the current React styling requires `style-src 'unsafe-inline'`. Remote scripts, workers, fonts and frames are blocked.

## Existing Web Core

- `src/state`, `src/db`: Zustand plus runtime-selected persistence, IndexedDB in browser and app-data filesystem in Tauri.
- `src/features/editor`: local Monaco workers.
- `src/features/pdfViewer`: local PDF.js worker.
- `src/features/compiler`: HTTP fallback compiler, still remote in this phase.
- `src/features/texEnvironment`: desktop diagnostics for existing local TeX tools, not local compilation.

WKWebView, WebView2 and WebKitGTK consume the same bundled UI and CSP. Native build jobs exercise configuration compatibility; they do not prove manual interaction or installed-app behavior.
