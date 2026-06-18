# TeXForge

TeXForge is a modern online LaTeX editor built as a React/Vite SPA. It focuses on local execution by using Monaco Editor and PDF.js workers directly, persisting data entirely client-side.

## Current State

- **Application Architecture:** React SPA utilizing Vite.
- **Persistence:** Local persistence backed securely by IndexedDB (`idb`). No external cloud synchronization or Firebase integration is currently active.
- **Compilation:** Uses a robust remote HTTP compilation fallback to ensure valid PDFs are produced without requiring heavy local WASM assets or a Docker backend.
- **Editor:** Integrated Monaco Editor with local worker scripts for performance.
- **PDF Viewer:** A basic, single-page PDF viewer using a locally imported PDF.js worker.
- **Collaboration:** Currently a single-player, local-persistence-first experience, with remote compilation currently required. No real-time collaboration features are implemented.
- **Desktop:** The application includes a Tauri v2 native foundation for macOS Apple Silicon (`aarch64-apple-darwin`), featuring secure IPC bindings and a dual-runtime structure capable of running both in a browser preview and as a native desktop application.

## Desktop Requirements

To run or build the desktop version (`npm run tauri:dev` / `npm run tauri:build`):

1. Install **Rust** via `rustup` (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`).
2. Ensure you have the target installed: `rustup target add aarch64-apple-darwin`.
3. Install **Xcode Command Line Tools**: `xcode-select --install`.

## Directory Structure

- `src/components/` - Resizable Layout, Header, Error Boundary.
- `src/features/` - Abstractions for discrete functions:
  - `editor`: Monaco Editor wrapper preserving view states between file switches.
  - `compiler`: HTTP-based remote LaTeX compilation.
  - `pdfViewer`: Isolated PDF.js container handling the rendering and lifecycle of PDF buffers.
  - `fileTree`: Project structure visualization and file management.
- `src/state/` - Zustand stores and structured IndexedDB interface.

## Known Limitations

- **Compilation**: The fallback remote compiler only supports the main content block, assigns the name `document.tex` unconditionally, and forces `pdfLaTeX`. It does not support complex multi-file structures recursively.
- SyncTeX is not currently available from the HTTP compilation fallback.
- The PDF Viewer renders only a single active page at a time.
- No real-time collaboration capabilities.
- Cloud saving and Google Drive integrations are theoretical boundaries mapped in the codebase but not functionally connected.

## Third-Party Licenses

- **PDF.js**: Licensed under Apache 2.0.
- **Monaco Editor**: Licensed under MIT.
- **Latex-Online Engine**: Provided via open HTTP compilation endpoint.

---

_Generated for AI Studio evaluation._
