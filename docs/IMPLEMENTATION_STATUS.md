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
| Compilation hardening                | verificato localmente | App-cache workspace, timeout, input/file/log/PDF caps, file-backed stdout/stderr and workspace cleanup are implemented                    |
| macOS local TeX CLI smoke            | verificato localmente | MacTeX/TeX Live 2025 `latexmk` and `pdflatex` are present; fixture CLI compile produced a PDF locally                                     |

## Deferred Beyond Current State

- SQLite metadata storage.
- Custom authorized runtime paths.
- SyncTeX, texlab/LSP, collaboration and Git.
- Security audit, packaging, signing, installers and updater.

The remote HTTP compiler remains active for browser builds. Desktop local compilation is implemented; local macOS TeX CLI smoke passed, but installed-app compile smoke and real-machine verification across Windows/Linux remain required before any operating system is declared release-supported.
