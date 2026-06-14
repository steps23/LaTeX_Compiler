# TeXForge Project Audit Report

* **Audit Date**: 2026-06-14
* **Intended Upstream Repository**: [steps23/LaTeX_Compiler](https://github.com/steps23/LaTeX_Compiler)
* **Branch**: Not verifiable in the current workspace
* **Commit**: Not verifiable
* **Working Tree Status**: Not verifiable
* **Reason**: `.git` metadata is not present in the inspected workspace. Git status, active branch, and commit history cannot be verified until the repository context is restored.

---

## 1. Files & Directories Inspected
* **Metadata & Config**: [package.json](package.json), [package-lock.json](package-lock.json), [tsconfig.json](tsconfig.json), [vite.config.ts](vite.config.ts), [.env](.env), [.env.example](.env.example), [README.md](README.md).
* **Backend Scaffold**: [server.ts](server.ts).
* **Frontend Source**:
  * [src/main.tsx](src/main.tsx), [src/App.tsx](src/App.tsx), [src/index.css](src/index.css).
  * [src/types/index.ts](src/types/index.ts).
  * [src/state/db.ts](src/state/db.ts), [src/state/store.ts](src/state/store.ts).
  * [src/components/Header.tsx](src/components/Header.tsx), [src/components/Layout.tsx](src/components/Layout.tsx).
  * [src/features/compiler/index.ts](src/features/compiler/index.ts), [src/features/compiler/HttpFallbackCompiler.ts](src/features/compiler/HttpFallbackCompiler.ts), [src/features/compiler/logParser.test.ts](src/features/compiler/logParser.test.ts).
  * [src/features/editor/MonacoEditor.tsx](src/features/editor/MonacoEditor.tsx).
  * [src/features/fileTree/FileSidebar.tsx](src/features/fileTree/FileSidebar.tsx).
  * [src/features/pdfViewer/PdfViewer.tsx](src/features/pdfViewer/PdfViewer.tsx).
* **Tauri Directory (`src-tauri/`)**: Not present (Verified by source directory inspection).

---

## 2. Dependencies Declared in package.json
* **Core React**: `react` (^19.0.1), `react-dom` (^19.0.1).
* **State & DB**: `zustand` (^5.0.14), `idb` (^8.0.3).
* **Styling**: `tailwindcss` (^4.1.14), `@tailwindcss/vite` (^4.1.14), `clsx` (^2.1.1), `tailwind-merge` (^3.6.0).
* **UI Utilities**: `lucide-react` (^0.546.0), `motion` (^12.23.24), `react-resizable-panels` (^2.1.7).
* **Editor & PDF**: `@monaco-editor/react` (^4.7.0), `pdfjs-dist` (^6.0.227).
* **Vite & Server**: `vite` (^6.2.3), `express` (^4.21.2), `dotenv` (^17.2.3).
* **Development**: `typescript` (~5.8.2), `vitest` (^4.1.8), `tsx` (^4.21.0), `@types/node` (^22.14.0), `@types/express` (^4.17.21).

---

## 3. Components Verified by Source Inspection
* **Layout Grid & Splitters** (Layout.tsx): The code configures resizable panes through `react-resizable-panels`; runtime behavior has not yet been verified.
* **Monaco Editor Mounting** (MonacoEditor.tsx): Monaco is imported through the installed `@monaco-editor/react` npm package. Monaco worker and tauri runtime behavior have not yet been tested.
* **IndexedDB Store creation** (db.ts): Code sets up IndexedDB database `texforge-db` version 1, creating `projects` (index `updatedAt`) and `files` (index `projectId`) stores; runtime behavior has not yet been verified.
* **Basic Log Parser Test** (logParser.test.ts): Includes a simple Vitest fixture validating the parsing of a single pdflatex command sequence error line; test command has not yet been run.

---

## 4. Partially Functional Features
* **LaTeX Compilation** (HttpFallbackCompiler.ts): The current fallback sends the selected main document content to `texlive.net`. It does not yet upload the complete multi-file project. A future multi-file fallback would potentially transmit additional sources, bibliography files, styles, images and other assets. (Verified by source inspection; runtime behavior not yet tested).
* **File Directory Sidebar** (FileSidebar.tsx): Only lists registered files as a flat list. There are no hierarchy representations, folder expanding/collapsing, file rename actions, or drag-and-drop operations (Verified by source inspection; runtime behavior not yet tested).
* **PDF Canvas Rendering** (PdfViewer.tsx): Renders a document onto a canvas using PDF.js. Basic zoom scaling and manual page stepping are configured, but the download button is decorative, and it lacks page virtualization or print integration (Verified by source inspection; runtime behavior not yet tested). The PDF.js worker is currently configured through an external `unpkg` URL and must be bundled locally to support offline execution.

---

## 5. Non-Functional UI Controls (Placeholders)
* **Header Dropdowns**: "File", "Edit", and "Project" dropdown menus are decorative elements styling plain HTML buttons (Verified by source inspection).
* **Share Button**: Exists in the header toolbar but performs no action (Verified by source inspection).
* **Visual Mode Toggle**: Renders "Visual Beta (Disabled)" and acts as a placeholder (Verified by source inspection).
* **PDF Download Action**: The PDF toolbar download button is present but has no click callback attached (Verified by source inspection).

---

## 6. Obsolete Web-First Assumptions
* **Hosted Backend Express Server** (server.ts): Relies on `express` and a proxy configuration to forward requests to `texlive.net`. The Express backend is obsolete for the final packaged Tauri application. It may remain temporarily only to keep the old web prototype runnable during migration. The packaged application must not depend on it, and Phase 7 acceptance requires no running Express service.
* **Client-Side Google Client Assumptions**: There is no Drive code present, but any implicit frontend-first OAuth or Drive API interactions must be prevented; all tokens and Drive HTTP commands will belong in the Rust backend.

---

## 7. Data-Loss & Security Risks
* **External Compilation Transmission**: When the current fallback compiler is invoked, it transmits the selected main document content to `texlive.net`. This is a significant data-privacy risk. The production desktop application must disable this fallback by default, requiring explicit user warning and approval before sending files.
* **Path Traversal Vulnerabilities**: The present IndexedDB implementation does not expose host filesystem traversal because it is browser-bound. However, carrying its unvalidated path model into the Rust filesystem implementation would create a traversal vulnerability.
* **Zustand Save Durability**: Zustand store updates local state immediately and fires database saves asynchronously without tracking. The latest changes may be lost, or the UI may report them as durable before persistence is confirmed. A robust write-pipeline with recovery cache is mandatory.
* **Conflict History Loss on File Deletion**: If the synchronization conflicts table utilizes an `ON DELETE CASCADE` constraint on the live file reference, deleting a local file would delete the historical conflict metadata and resolved history. To preserve auditing and retention requirements, conflict records must survive file deletion by employing `ON DELETE SET NULL` on a nullable live reference, alongside immutable historical columns (`file_uuid_at_detection`, `relative_path_at_detection`) and a unique conflict index.

---

## 8. Migration & Refactoring Roadmap

### Components to Retain
* **Frontend Framework**: React + TypeScript components.
* **Source Editor**: Monaco editor and the styling system.
* **PDF Canvas**: The core PDF rendering canvas context.

### Components to Refactor
* **Zustand Store** (store.ts): Replace all browser-specific storage saves and mock compiling fetches with Tauri typed IPC invoke calls.
* **File Sidebar** (FileSidebar.tsx): Convert into a recursive directory tree.
* **PDF Viewer** (PdfViewer.tsx): Change worker to local asset and attach actual print/download handlers.
* **Database Interface** (db.ts): Retain or refactor `src/state/db.ts` temporarily as a legacy browser export adapter until `.texforge.zip` export is implemented and verified.
  * Browser IndexedDB reading and export remain in TypeScript.
  * Desktop archive validation and import remain in Rust.
  * `src/state/db.ts` must not extract archives or write arbitrary desktop files.

### Components to Retire
* **Express Proxy** (server.ts): Replaced with Rust commands.
* **IndexedDB Storage** (db.ts): Replaced by local file writes and Rust SQLite.
  * **Retirement Warning**: `src/state/db.ts` must not be retired until:
    1. The canonical legacy export path (`<project-name>.texforge.zip`) has been implemented.
    2. Exports have been tested.
    3. Migration data has been verified.
    4. The browser prototype no longer depends on it.

---

## 9. Environment, Secrets & Git Audit
* **.env Verification**: A `.env` file exists in the workspace. Its secrets and parameters must not be reproduced in any documentation files.
* **Verification Checklist**: When the Git repository context is restored:
  * Verify whether `.env` is ignored by Git using `.gitignore` inspection.
  * Verify that no OAuth secrets, API keys, or secret tokens are committed in repository history.
  * Ensure that `.env.example` remains in the workspace but is completely free of real credentials.
  * Rotate any credentials found committed in repository history.

---

## 10. Planned Architectural Risks & Implementation Checks
The following items represent planned subsystems that must be verified when implementation begins:
* **Platform-Native App-Data Paths**: Platform-native application directories (`<app-data-dir>/recovery/` etc.) resolved by Rust/Tauri are not yet implemented.
* **Drive File IDs**: Target Google Drive file identifiers do not exist in the current prototype.
* **Stable Compilation IDs**: The current frontend compiler does not utilize stable compilation request IDs.
* **Shell Escape Restrictions**: Shell escape behavior must be explicitly verified to ensure it is completely disabled when local compiler support is introduced.
* **Tauri Capability Scope**: Tauri 2 capability files must be explicit and minimal. React must not receive a general filesystem or shell execution surface; any Tectonic sidecar permission must be exact-binary and exact-argument scoped.
* **Git Repository Integrity**: `.gitignore` rules, secret history, and active branches remain unverified due to the absence of `.git` metadata.
* **SQLite Main-Document Referential Action**: `project_settings.main_file_uuid` must not use a composite `ON DELETE SET NULL` key that includes `project_uuid`; otherwise deleting a main document can attempt to null the project identity. Use a single-column file reference plus triggers/Rust validation for same-project and file-kind rules.
* **Phase 8 SQLite Rebuild**: The generalized `projects` table-rebuild
  procedure remains documentation-only until implemented and verified with
  migration, rollback, row-count and foreign-key tests.
* **OAuth Desktop Boundary**: Google OAuth must use the system browser, loopback redirect, PKCE S256 and random state validation. Authorization must not be embedded in the Tauri WebView.
* **Drive Identity Scope**: The project/account scope of `drive_file_id` must
  be verified with multiple Google accounts, shared Drive files and repeated
  remote visibility scenarios.
* **Drive Scope Limitation**: The planned `drive.file` scope limits default
  discovery to files created by TeXForge or explicitly opened/shared with the
  app; arbitrary whole-Drive browsing is not available without a separate
  consent and verification strategy.
* **Queue Lease Recovery**: Lease renewal, application-crash recovery, expired
  lease reclamation and idempotent operation retry require automated tests.
* **Conflict Snapshot Isolation**: Snapshot directories must be verified to use
  a unique `conflict_id`, preventing later conflicts for the same file from
  overwriting historical snapshots.
* **Conflict Live Reference Referential Action**: The conflicts table must set
  only the nullable `file_uuid` live reference to NULL on file deletion, while
  retaining `project_uuid`, `file_uuid_at_detection`, and
  `relative_path_at_detection` for history.

---

## 11. Blockers & Technical Prerequisites
* **Rust Toolchain**: The Rust compiler and cargo are currently not available in the agent shell environment. Setting up the `src-tauri/` project requires cargo and Tauri dependencies. The local environment must be configured before Phase 1 cargo compilation checks can be executed.
