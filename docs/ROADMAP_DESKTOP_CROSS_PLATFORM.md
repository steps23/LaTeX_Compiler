# Desktop Cross-Platform Roadmap

Initial targets:

- macOS Apple Silicon: `aarch64-apple-darwin`;
- macOS Intel: `x86_64-apple-darwin`;
- Windows x64: `x86_64-pc-windows-msvc`;
- Linux x64: `x86_64-unknown-linux-gnu`, Ubuntu 22.04 reference runner.

Windows ARM64 and Linux ARM64 are not initial targets.

## Phase Status

1. Prompt 3: Tauri 2 foundation, hash routing, versioned runtime IPC, least-privilege capability, CSP and native CI matrix. Implemented in code; platform evidence remains tracked in `SUPPORT_MATRIX.md`.
2. Prompt 4: project storage and filesystem adapters. Implemented runtime-selected repository adapters: browser keeps IndexedDB; Tauri stores project metadata and files under the app-owned app-data `projects` directory through bounded IPC. SQLite metadata remains deferred.
3. Local TeX runtime and compiler adapters. Runtime diagnostics, global/project selection and a bounded desktop compile command are implemented; custom runtime paths, package management and real-machine cross-platform TeX smoke tests remain deferred.
4. SyncTeX and LSP. SyncTeX generation plus bounded source-to-PDF lookup primitives are implemented; reverse PDF-to-source UI and texlab/LSP remain deferred.
5. Local/LAN collaboration and Git. Not started here.
6. Security hardening, reliability, packaging, signing and updater. Not started here.

Platform-specific Rust code must remain behind adapters and `cfg` boundaries. Core commands and UI terminology remain platform-neutral.
