# Implementation Status

Status labels: `predisposto`, `verificato localmente`, `verificato in CI`, `verificato su macchina reale`, `non verificato`.

## Prompt 3

| Area                                 | Stato                 | Evidence                                                                     |
| ------------------------------------ | --------------------- | ---------------------------------------------------------------------------- |
| React/Vite browser baseline          | verificato localmente | Frontend gates and browser unit/component tests                              |
| Hash routing                         | verificato localmente | Direct route, refresh, fallback, back and forward tests                      |
| Runtime IPC contract v1              | verificato localmente | TypeScript validation tests and Rust serialization test                      |
| Desktop Vite startup without Express | predisposto           | Tauri config points directly to Vite; local smoke recorded in support matrix |
| Window restore                       | predisposto           | Official window-state plugin configured; persistence requires restart smoke  |
| Least-privilege capability           | verificato localmente | Only `core:default`; no fs, shell, dialog, opener or process permission      |
| CSP on WKWebView                     | predisposto           | Local native build/smoke evidence recorded separately                        |
| CSP on WebView2                      | predisposto           | Native Windows CI job configured; no completed run recorded here             |
| CSP on WebKitGTK                     | predisposto           | Native Ubuntu CI job configured; no completed run recorded here              |
| macOS Apple Silicon                  | verificato localmente | `npm run tauri:build -- --debug` produced local app and DMG on host          |
| macOS Intel                          | predisposto           | Native `macos-15-intel` CI job configured; no completed run recorded here    |
| Windows x64                          | predisposto           | Native `windows-2022` CI job configured; no completed run recorded here      |
| Linux x64                            | predisposto           | Native `ubuntu-22.04` CI job configured; no completed run recorded here      |

The earlier public CI run `27682061084` covers the pre-Prompt-3 baseline only. It is not evidence for this desktop matrix.

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

| Area                                 | Stato                 | Evidence                                                                                       |
| ------------------------------------ | --------------------- | ---------------------------------------------------------------------------------------------- |
| TeX runtime diagnostic contract v1   | verificato localmente | TypeScript validation tests and Rust serialization test                                        |
| Bounded TeX tool detection           | verificato localmente | Rust tests cover absent runtime and fixture binaries; no shell is invoked                      |
| TeX Environment UI                   | verificato localmente | Frontend typecheck, lint, tests and build pass; route available at `#/tex-environment`         |
| MacTeX / TeX Live / MiKTeX detection | predisposto           | Known platform paths and PATH probing implemented; real Windows/Linux/MiKTeX runs not recorded |
| Runtime selection                    | non verificato        | Deferred to a later Prompt 5 increment                                                         |
| Package management                   | non verificato        | Deferred; no `tlmgr`/`mpm` mutations or installation flows implemented                         |
| Local compilation                    | non verificato        | Deferred to Prompt 6; remote HTTP compiler fallback remains active                             |

## Deferred Beyond Current State

- SQLite metadata storage.
- Runtime selection and per-project TeX runtime settings.
- Local TeX compilation.
- SyncTeX, texlab/LSP, collaboration and Git.
- Security audit, packaging, signing, installers and updater.

The remote HTTP compiler remains active. TeXForge is therefore not yet an offline desktop editor and no operating system is declared release-supported.
