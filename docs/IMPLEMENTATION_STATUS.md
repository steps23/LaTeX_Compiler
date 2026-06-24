# Implementation Status

Status labels: `predisposto`, `verificato localmente`, `verificato in CI`, `verificato su macchina reale`, `non verificato`.

## Prompt 3

| Area                                 | Stato                 | Evidence                                                                               |
| ------------------------------------ | --------------------- | -------------------------------------------------------------------------------------- |
| React/Vite browser baseline          | verificato localmente | Frontend gates and browser unit/component tests                                        |
| Hash routing                         | verificato localmente | Direct route, refresh, fallback, back and forward tests                                |
| Runtime IPC contract v1              | verificato localmente | TypeScript validation tests and Rust serialization test                                |
| Desktop Vite startup without Express | verificato in CI      | Tauri debug builds run from bundled Vite assets; `server.ts` is not used by desktop CI |
| Window restore                       | verificato in CI      | Official window-state plugin compiles and bundles across the desktop CI matrix         |
| Least-privilege capability           | verificato in CI      | Only `core:default`; frontend/Rust gates and native builds pass in CI                  |
| CSP on WKWebView                     | verificato in CI      | macOS Apple Silicon and Intel Tauri debug app bundle builds pass in CI                 |
| CSP on WebView2                      | verificato in CI      | Windows x64 Tauri debug build passes in CI                                             |
| CSP on WebKitGTK                     | verificato in CI      | Ubuntu x64 Tauri debug build passes in CI                                              |
| macOS Apple Silicon                  | verificato in CI      | `macos-15` / `aarch64-apple-darwin` CI build passes; local app and DMG also built      |
| macOS Intel                          | verificato in CI      | `macos-15-intel` / `x86_64-apple-darwin` CI app bundle build passes                    |
| Windows x64                          | verificato in CI      | `windows-2022` / `x86_64-pc-windows-msvc` CI build passes                              |
| Linux x64                            | verificato in CI      | `ubuntu-22.04` / `x86_64-unknown-linux-gnu` CI build passes                            |

CI evidence: public run `28040181526` passed frontend gates plus Tauri format, clippy, tests, checks and unsigned debug builds across Ubuntu x64, Windows x64, macOS Intel and macOS Apple Silicon. macOS CI intentionally builds `.app` bundles only; DMG packaging, signing and notarization remain deferred.

## Prompt 4

| Area                           | Stato                 | Evidence                                                                           |
| ------------------------------ | --------------------- | ---------------------------------------------------------------------------------- |
| Storage info IPC contract v1   | verificato localmente | TypeScript validation tests and Rust serialization test                            |
| App data project root          | verificato localmente | Tauri command resolves and creates app-owned `projects` directory; Rust gates pass |
| Native project repository      | verificato localmente | Runtime-selected adapter uses Tauri IPC for project list/get/save/delete           |
| Native file repository         | verificato localmente | Runtime-selected adapter uses Tauri IPC for file list/get/save/delete              |
| Project path validation        | verificato localmente | Rust test rejects absolute paths and parent traversal                              |
| Browser IndexedDB preservation | verificato localmente | Existing browser tests pass with runtime-selected repository                       |
| SQLite metadata storage        | non verificato        | Deferred; metadata is JSON manifest in app-data project directory for this phase   |

## Prompt 5 Baseline

| Area                                 | Stato                 | Evidence                                                                                                                                  |
| ------------------------------------ | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| TeX runtime diagnostic contract v1   | verificato localmente | TypeScript validation tests and Rust serialization test                                                                                   |
| Bounded TeX tool detection           | verificato localmente | Rust tests cover absent runtime and fixture binaries; no shell is invoked                                                                 |
| TeX Environment UI                   | verificato localmente | Frontend typecheck, lint, tests and build pass; route available at `#/tex-environment`                                                    |
| MacTeX / TeX Live / MiKTeX detection | verificato in CI      | Detection code and fixture tests pass on macOS, Windows and Linux CI; real installed distributions are still not verified                 |
| Runtime selection                    | verificato localmente | Global selection persists in browser local storage or Tauri app-data JSON; only currently detected runtime IDs are accepted               |
| Per-project runtime settings         | verificato localmente | Projects can inherit global selection, override it with a detected runtime ID, explicitly disable runtime usage and choose compile engine |
| Custom runtime paths                 | non verificato        | Deferred; arbitrary executable paths are not accepted                                                                                     |
| Package management                   | non verificato        | Deferred; no `tlmgr`/`mpm` mutations or installation flows implemented                                                                    |
| Local compilation                    | verificato localmente | Desktop adapter and native command compile through selected detected TeX executable/engine; no shell or arbitrary path is exposed         |
| Compilation hardening                | verificato localmente | App-cache workspace, timeout/cancellation, input/file/log/PDF caps, file-backed stdout/stderr and cleanup are implemented                 |
| macOS local TeX CLI smoke            | verificato localmente | MacTeX/TeX Live 2025 `latexmk` and `pdflatex` are present; fixture CLI compile produced a PDF locally                                     |

## Prompt 7 Baseline

| Area                         | Stato                 | Evidence                                                                                                                          |
| ---------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| SyncTeX generation           | verificato localmente | Native compile command passes `-synctex=1` to `latexmk`, `pdflatex`, `xelatex` and `lualatex` fixed-argument invocations          |
| SyncTeX artifact boundary    | verificato localmente | Successful desktop compiles retain app-cache `main.pdf`/`main.synctex(.gz)` artifacts by validated job ID; failed workspaces drop |
| SyncTeX forward lookup IPC   | verificato localmente | `query_synctex_forward` validates artifact ID, project-relative input path and 1-based line; Rust parses `synctex view` records   |
| Frontend SyncTeX adapter     | verificato localmente | `src/utils/syncTex.ts` calls the bounded native command in Tauri and returns `null` in browser mode                               |
| Reverse PDF-to-source lookup | verificato localmente | Implemented in Prompt 9 through bounded `synctex edit` IPC and PDF double-click source navigation                                 |
| Installed-app SyncTeX smoke  | non verificato        | Deferred; CLI documentation and unit/contract tests only                                                                          |

## Prompt 8 Baseline

| Area                          | Stato                 | Evidence                                                                                                                           |
| ----------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| texlab detection              | verificato localmente | Runtime diagnostic now includes `texlab` in the allowlisted tool scan and reports `capabilities.hasTexlab`                         |
| LSP JSON-RPC framing          | verificato localmente | Rust unit test covers `Content-Length` message framing and completion response parsing                                             |
| Bounded texlab completion IPC | verificato localmente | `query_latex_lsp_completions` validates runtime ID, project-relative paths and 1-based cursor, writes app-cache workspace snapshot |
| Frontend LSP adapter          | verificato localmente | `src/utils/latexLsp.ts` validates completion payloads and sends selected-runtime/project snapshot payloads                         |
| Monaco completion bridge      | verificato localmente | LaTeX Monaco completion provider calls the frontend LSP adapter and degrades to empty suggestions on unavailable native LSP        |
| Persistent LSP session        | non verificato        | Deferred; current bridge is one-shot per completion request                                                                        |
| LSP diagnostics/hovers        | non verificato        | Deferred; no `publishDiagnostics`, hover or document-symbol UI yet                                                                 |
| Real texlab smoke             | non verificato        | Deferred; `texlab` is not installed on this local host                                                                             |

## Prompt 9 Baseline

| Area                                | Stato                 | Evidence                                                                                                                               |
| ----------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| SyncTeX reverse IPC                 | verificato localmente | `query_synctex_reverse` validates artifact/page/coordinates and invokes detected `synctex edit -o page:x:y:main.pdf` in app cache      |
| SyncTeX reverse parser              | verificato localmente | Rust tests parse `Input`, `Line`, `Column`, `Offset` and reject project-path escape during source path normalization                   |
| PDF click coordinate mapping        | verificato localmente | PDF.js canvas double-click maps CSS viewport coordinates to SyncTeX big-point top-left coordinates using the active preview scale      |
| PDF-to-source navigation UI         | verificato localmente | PDF preview exposes “SyncTeX reverse ready”; double-click jumps to the matching Monaco file and line through the existing store action |
| Installed-app reverse SyncTeX smoke | non verificato        | Deferred; app is installed locally but manual click-through smoke is not recorded                                                      |

## Deferred Beyond Current State

- SQLite metadata storage.
- Custom authorized runtime paths.
- Persistent texlab/LSP diagnostics/hovers, collaboration and Git.
- Security audit, packaging, signing, installers and updater.

The remote HTTP compiler remains active for browser builds. Desktop local compilation is implemented; local macOS TeX CLI smoke passed, but installed-app compile smoke and real-machine verification across Windows/Linux remain required before any operating system is declared release-supported.
