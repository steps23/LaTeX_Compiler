# TeXForge

TeXForge is a React 19/Vite LaTeX editor with a Tauri 2 desktop foundation. The same UI runs in an isolated browser mode and in native webviews on macOS, Windows and Linux.

## Current State

- Monaco Editor and PDF.js use local bundled workers; no CDN assets are loaded.
- Browser projects remain in IndexedDB; desktop projects use app-data filesystem storage through bounded Tauri IPC.
- Browser compilation uses the remote HTTP fallback; desktop compilation uses the selected detected local TeX runtime.
- Desktop IPC exposes versioned runtime/storage info, bounded project/file persistence commands, local TeX runtime diagnostics, selected-runtime persistence and bounded local compilation.
- Tauri restores window position, size and maximized state through the official window-state plugin.
- Filesystem, shell, dialog, opener and process capabilities are not granted in this phase.
- A LaTeX Environment screen detects and selects existing TeX Live, MacTeX or MiKTeX tools from bounded Rust code without invoking a shell, accepting arbitrary executable paths or modifying system installations.
- Desktop builds can compile/cancel jobs with the selected local TeX runtime and per-project engine selection through bounded Tauri commands; browser builds continue to use the HTTP fallback compiler.

See [Implementation Status](docs/IMPLEMENTATION_STATUS.md) and [Support Matrix](docs/SUPPORT_MATRIX.md) for evidence levels. A configured CI job is not an installed-app or real-machine test.

## Browser Mode

```bash
npm ci
npm run dev
```

`npm run dev` keeps the existing Express-backed browser preview. `npm run web:dev` starts Vite directly.

## Desktop Mode

```bash
npm ci
npm run tauri:dev
npm run cargo:check
npm run tauri:build -- --debug
```

`tauri:dev` starts Vite directly on `127.0.0.1:5173`; it does not start or require Express.

Prerequisites:

- macOS: Node.js 22+, Rust with the host target, and Xcode Command Line Tools or Xcode.
- Windows x64: Node.js 22+, Rust MSVC, Microsoft C++ Build Tools and WebView2.
- Ubuntu 22.04 x64: Node.js 22+, Rust, a C/C++ toolchain, WebKitGTK 4.1, Ayatana AppIndicator, librsvg and patchelf.

Initial targets are `aarch64-apple-darwin`, `x86_64-apple-darwin`, `x86_64-pc-windows-msvc` and `x86_64-unknown-linux-gnu`. Do not force a non-host target for local development unless the required cross-build environment is available.

## Quality Gates

```bash
npm run check:all
npm run cargo:check
```

## Known Limitations

- No SQLite, SyncTeX integration, LSP, collaboration, installer signing or updater yet.
- Browser persistence is IndexedDB; desktop persistence is app-data filesystem backed. Browser compilation still reaches the configured HTTP compiler.
- Local TeX runtime detection, selected-runtime persistence, per-project runtime/engine overrides and local desktop compilation exist; custom runtime paths and package management are deferred.
- Windows ARM64 and Linux ARM64 are not Prompt 3 targets.
