# TeXForge

TeXForge is a modern, collaborative online LaTeX editor. It provides real-time compilation, a responsive interface, and support for both guest-mode offline persistence and unified cloud workflows.

## Environment Compatibility

*   **Google AI Studio Preview:** Runs perfectly out of the box in the iframe preview using Guest Mode. Guest mode is securely backed by IndexedDB and uses a robust HTTP compilation fallback to ensure that valid PDFs are produced without downloading hundreds of megabytes of WASM assets on every isolated browser boot.
*   **Firebase / Cloud Run:** Not yet explicitly connected to a Firebase instance out of the box, however, the persistence engine (`src/state/db.ts`) exposes clearly separated data interfaces mapping directly to Firestore data models to be swapped easily if `COMPILER_MODE=server` or cloud credentials are set.
*   **Server Compiler:** The application includes a backend pattern scaffold to switch to `tectonic` or `texlive` based backends if deployed to a Docker container via Cloud Run.

## Architecture Guidelines

*   `src/components/` - Resizable Layout and App Chrome.
*   `src/features/` - Abstractions for discrete functions:
    *   `editor`: Monaco Editor wrapper and markers.
    *   `compiler`: Unified compilation abstraction supporting the current HTTP/WASM implementation.
    *   `pdfViewer`: Isolated PDF.js container handling blob array parsing and virtualization.
    *   `fileTree`: Project structures.
*   `src/state/` - Application State and strictly-typed IndexedDB interface.

## Known Limitations
*   SyncTeX is not currently available from the HTTP compilation fallback. Source-to-PDF click requires WASM engines that support outputting the `.synctex` binary file block.

## Third-Party Licenses
*   **PDF.js**: Licensed under Apache 2.0.
*   **Monaco Editor**: Licensed under MIT.
*   **Latex-Online Engine (Fallback)**: Provided as a public good API by external developers.

---
*Generated for AI Studio evaluation.*
