# Project Handoff Status

Date: 2026-06-24
Project: TeXForge / LaTeX_Compiler
Repository: `/Users/stefano_ruggiero/Documents/GitHub/LaTeX_Compiler`
Reference worktree/prompt source: `/Users/stefano_ruggiero/Documents/LaTeX app/texforge-prompt-03`

## Current Summary

The repository has advanced beyond the `texforge-prompt-03` reference baseline with local TeX compilation, SyncTeX, texlab/LSP, Prompt 9 reverse SyncTeX UI, compile feedback and app icon work.

Status: `verificato localmente`

Latest phase added: Prompt 9 SyncTeX reverse UI baseline — the PDF preview can double-click back to source through a bounded `synctex edit` IPC command.

## What Has Been Done

- React 19 + Vite browser baseline present.
- Tauri 2 desktop foundation present.
- Hash routing present and covered by tests.
- Runtime IPC contract v1 present.
- Storage IPC contract v1 present.
- Browser persistence through IndexedDB preserved.
- Desktop persistence through bounded Tauri IPC and app-data project storage present.
- Native project repository adapter present.
- Native file repository adapter present.
- Project/file path validation present; absolute paths and parent traversal are rejected.
- Monaco and PDF.js workers are bundled locally; no CDN worker dependency.
- Tauri dev mode starts Vite directly through `npm run web:dev`; Express is not required for desktop mode.
- Tauri capability is least-privilege for this phase: `core:default` only.
- Tauri CSP configured for production and development.
- Window restore plugin dependency present and configured in Rust.
- Frontend and Rust/Tauri local gates pass when Rust toolchain is on `PATH`.
- CI run `28040181526` passes frontend gates and the desktop Tauri matrix for Ubuntu x64, Windows x64, macOS Intel and macOS Apple Silicon.
- macOS CI builds unsigned `.app` bundles only to avoid unsigned DMG packaging fragility; installer packaging remains deferred.
- Local TeX runtime diagnostic contract v1 is implemented.
- Rust detects allowlisted TeX tools from process `PATH` and known platform TeX directories without invoking a shell.
- Global selected-runtime persistence is implemented through versioned browser local storage or Tauri app-data JSON.
- Per-project runtime overrides are implemented in `ProjectSettings.texRuntimeId`; omitted means inherit global, `null` means disabled for that project, and a string means project-specific detected runtime ID.
- Per-project compile engine selection is implemented in `ProjectSettings.texCompileEngine` with the allowlist `auto`, `latexmk`, `pdflatex`, `xelatex`, `lualatex`.
- Tauri runtime selection accepts only currently detected runtime IDs; arbitrary executable paths remain deferred.
- Desktop compilation now uses `compile_latex_project`, writes a temporary workspace under Tauri app cache, rejects oversized input/file sets, validates the project engine allowlist, invokes an explicit detected TeX executable with fixed arguments via Rust `Command`, supports cancellation through job IDs, uses file-backed stdout/stderr with capped log reads, reads size-capped `main.pdf` and removes failed/transient workspaces.
- Prompt 7 SyncTeX baseline is implemented: fixed TeX invocations pass `-synctex=1`, successful native compiles retain app-cache artifacts by validated job ID, and `query_synctex_forward` runs detected `synctex view` with validated project-relative input paths and 1-based line numbers.
- Prompt 8 texlab/LSP baseline is implemented: runtime diagnostics detect allowlisted `texlab`, `query_latex_lsp_completions` validates runtime/path/cursor input, writes a bounded app-cache workspace snapshot, speaks LSP JSON-RPC over texlab stdio for one-shot completion, and Monaco's LaTeX completion provider degrades to empty suggestions when texlab is unavailable.
- Prompt 9 SyncTeX reverse UI baseline is implemented: `query_synctex_reverse` validates the compile artifact and page/coordinate input, invokes detected `synctex edit -o page:x:y:main.pdf` inside the persisted app-cache artifact, normalizes the returned source path back to a project-relative path, and the PDF.js preview double-click jumps Monaco to the returned file and line.
- Browser compilation continues to use the HTTP fallback compiler.
- LaTeX Environment screen is available at `#/tex-environment` from the dashboard and can select/clear global runtime plus set project inherit/disable/override behavior when a project is open.

## Latest Verification

Run from:

```bash
cd /Users/stefano_ruggiero/Documents/GitHub/LaTeX_Compiler
```

### CI Gate

```bash
gh run view 28040181526 --json status,conclusion,jobs
```

Result: passed.

Evidence:

- Frontend job passed `npm run check:all` on Ubuntu 22.04.
- Tauri Ubuntu x64 job passed Rust format, clippy, tests, check and unsigned debug build.
- Tauri Windows x64 job passed Rust format, clippy, tests, check and unsigned debug build.
- Tauri macOS Apple Silicon job passed Rust format, clippy, tests, check and unsigned `.app` debug build.
- Tauri macOS Intel job passed Rust format, clippy, tests, check and unsigned `.app` debug build.

### Runtime Selection Targeted Checks

```bash
npm test -- src/utils/texRuntime.test.ts
PATH="$HOME/.cargo/bin:$PATH" cargo test --manifest-path src-tauri/Cargo.toml tex_runtime_selection_uses_the_versioned_frontend_contract -- --nocapture
```

Result: passed.

Evidence:

- Vitest: 1 file, 8 tests passed.
- Rust targeted test passed.

### Frontend Gate

```bash
npm run check:all
```

Result: passed.

Evidence:

- Prettier format check passed.
- TypeScript typecheck passed.
- ESLint passed.
- Vitest passed: 19 test files, 68 tests.
- Vite/web build passed.
- Server bundle build passed.

Build warnings observed but non-blocking:

- Vite reports one module both statically and dynamically imported.
- Some output chunks exceed 500 kB after minification.

### Rust/Tauri Gate

Initial command:

```bash
npm run cargo:check
```

Result: failed because `cargo` was not on shell `PATH`.

Working command:

```bash
PATH="$HOME/.cargo/bin:$PATH" npm run cargo:check
```

Result: passed.

Evidence:

- `cargo fmt --check --manifest-path src-tauri/Cargo.toml` passed.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings` passed.
- `cargo test --manifest-path src-tauri/Cargo.toml` passed: 19 tests.
- `cargo check --manifest-path src-tauri/Cargo.toml` passed.

### Git State

```bash
git status --short
```

Result before this update: clean at `b4708832`.

Current intended changes:

- `src-tauri/src/lib.rs` adds `compile_latex_project`, `cancel_latex_compile`, `query_synctex_forward`, `query_synctex_reverse`, `query_latex_lsp_completions`, bounded compile/LSP workspaces/artifacts, explicit TeX/SyncTeX/texlab process invocation, engine allowlist validation, timeout/cancellation/input/file/log/PDF/LSP caps, non-`latexmk` two-pass fallback and native compile/SyncTeX/LSP result/limit tests.
- `src/features/compiler/index.ts` selects native local compiler in Tauri and HTTP fallback in browser.
- `src/features/compiler/NativeLocalCompiler.ts` adds the desktop compiler adapter.
- `src/features/compiler/NativeLocalCompiler.test.ts` covers native compile IPC payloads and PDF byte hydration.
- `src/components/Header.tsx` passes the current project to compiler resolution.
- `src/types/index.ts` allows compiler adapters to receive optional project context and defines `TexCompileEngine`, `SyncTexArtifact` and `SyncTexLocation`.
- `src/utils/syncTex.ts` adds the frontend bounded SyncTeX forward-lookup adapter.
- `src/utils/syncTex.test.ts` covers native IPC payload shaping.
- `src/utils/latexLsp.ts` adds the frontend bounded texlab completion adapter.
- `src/utils/latexLsp.test.ts` covers completion payload validation and native IPC payload shaping.
- `src/features/editor/MonacoEditor.tsx` registers a LaTeX completion provider backed by the texlab adapter.
- `src/features/texEnvironment/TexEnvironment.tsx` displays texlab availability per detected runtime.
- `README.md`, `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION_STATUS.md` and this file document the local desktop compilation baseline.

## External Documentation Checked

Authoritative/current docs were checked through Context7:

- Tauri v2 docs: `/websites/v2_tauri_app`
- Tauri source/API docs: `/tauri-apps/tauri`
- Vite v6 docs: `/websites/v6_vite_dev`
- Topics checked:
  - Tauri 2 capabilities and `core:default`
  - Tauri Rust command invocation/state/security and shell risk guidance
  - window-state plugin setup
  - app-data/security-related patterns
  - command access from Rust through `AppHandle`
  - runtime-authority/capability denial model
  - Rust `Command` process invocation and timeout handling
  - SyncTeX CLI `view` and `edit` semantics from local TeX Live `synctex help view` / `synctex help edit` output
  - PDF.js canvas rendering, HiDPI viewport scaling and `PageViewport.convertToPdfPoint` behavior from `/mozilla/pdf.js`
  - texlab LSP internals and completion/build request behavior from `/latex-lsp/texlab`
  - LSP 3.17 initialize, `textDocument/didOpen`, `textDocument/completion` and `Content-Length` JSON-RPC framing from `/microsoft/language-server-protocol`
  - Vite build/code-splitting guidance for known bundle warnings

Relevant alignment:

- `src-tauri/capabilities/default.json` grants only `core:default`.
- `src-tauri/Cargo.toml` includes `tauri-plugin-window-state = "2"`.
- Storage and runtime selection use app data directory through Tauri path API in Rust, not broad frontend filesystem access.
- Runtime selection and local compilation keep command scope narrow and do not expose shell/process APIs to the frontend; the Tauri shell plugin remains unused.

## Important Files

- `README.md` — project overview, browser/desktop usage, quality gates, limitations.
- `AGENTS.md` — repository work rules and required checks.
- `docs/IMPLEMENTATION_STATUS.md` — status matrix through Prompt 9 baseline.
- `docs/SUPPORT_MATRIX.md` — platform/evidence matrix.
- `docs/ARCHITECTURE.md` — architecture overview.
- `src-tauri/tauri.conf.json` — Tauri build/dev/CSP/window config.
- `src-tauri/capabilities/default.json` — Tauri permissions.
- `src-tauri/src/lib.rs` — Rust IPC commands and storage backend.
- `src-tauri/src/tex_runtime.rs` — bounded TeX runtime/tool detection.
- `src/utils/texRuntime.ts` — frontend TeX runtime diagnostic and selection contract.
- `src/features/texEnvironment/TexEnvironment.tsx` — LaTeX Environment diagnostics and selection UI.
- `src/` — React/Vite frontend.
- `test/` and `src/**/*.test.tsx` — frontend/unit tests.

## What Remains / Deferred Work

The app is not yet a fully offline production desktop LaTeX editor. Deferred or incomplete areas:

- Custom authorized runtime paths.
- Real distribution verification on Windows/Linux and installed-app smoke tests.
- Installed-app/manual smoke for PDF-to-source SyncTeX UI.
- Persistent texlab/LSP session, diagnostics, hover and document-symbol UI.
- Real-machine texlab smoke test.
- SQLite metadata storage; current desktop metadata uses JSON manifests in app-data project directories.
- Collaboration features.
- Git integration.
- Security audit beyond local least-privilege checks.
- Installer signing/notarization.
- Auto-updater.
- Real-machine verification on Windows x64.
- Real-machine verification on Linux x64.
- macOS Intel verification.
- Installed-app smoke tests for the current desktop matrix.
- Cross-platform installed-app smoke tests.
- Performance tuning/code splitting for large frontend chunks.

## Known Constraints

- Do not grant global filesystem access.
- Do not add generic shell execution from the frontend.
- Keep React/TypeScript and Rust separated through typed contracts.
- Keep platform-specific code behind adapters.
- Do not claim cross-platform support unless verified on target OS/hardware or CI runner.
- Desktop mode must not require Express/web server runtime beyond Vite dev server during development.
- Remote HTTP compiler fallback still exists for browser builds; desktop local compilation needs real-machine verification before release-support claims.

## Recommended Next Agent Flow

1. Read:
   - `AGENTS.md`
   - `README.md`
   - `docs/IMPLEMENTATION_STATUS.md`
   - `docs/ARCHITECTURE.md`
   - this file
2. Run:

```bash
git status --short
npm run check:all
PATH="$HOME/.cargo/bin:$PATH" npm run cargo:check
```

3. Pick exactly one next phase.
4. Write a brief file-by-file plan before edits.
5. Make smallest coherent diff.
6. Run targeted tests first, then full gates.
7. Update this file with:
   - changed files
   - commands run
   - verification status
   - remaining risks
8. Do not commit/push unless explicitly requested.

## Suggested Next Phase Options

### Option A — Complete Prompt 5 Runtime Selection

Goal: extend the current selected-runtime baseline into full runtime selection.

Already done:

- Persistent global runtime selection settings.
- Per-project inherit/disable/override settings.
- Selection limited to currently detected runtime IDs.

Likely remaining scope:

- Custom authorized runtime paths.
- Better architecture/version compatibility checks.
- Diagnostic export with home/user redaction.
- Real checks on Windows x64 and Linux x64.

Acceptance:

- No generic shell exposed to frontend.
- No system PATH mutation.
- Frontend/Rust gates pass.

### Option B — Local Compilation Backend

Goal: compile a project locally through bounded Rust command execution.

Already done:

- Job workspace under app-managed cache directory.
- Selected detected TeX executable only; no arbitrary compiler path.
- Per-project compile engine selection.
- Compile cancellation from the toolbar while a job is running.
- Fixed compiler arguments, no shell, timeout and workspace cleanup.
- File-backed compiler stdout/stderr, compile input/file caps, capped log reads and PDF size cap.
- Two-pass fallback for direct `pdflatex`/`xelatex`/`lualatex` execution.
- PDF byte collection and baseline error log parsing.
- Frontend IPC adapter and native result contract test.

Likely remaining scope:

- More granular output/artifact policy controls.
- Installed-app compile smoke on macOS.
- Real TeX smoke tests on Windows and Linux.

### Option C — Platform Verification Matrix

Goal: convert prepared platform support into verified evidence.

Likely scope:

- CI runs on macOS Intel, Windows x64, Linux x64.
- Smoke scripts for app launch/build artifacts.
- Update `docs/SUPPORT_MATRIX.md` and `docs/IMPLEMENTATION_STATUS.md` with exact evidence.

### Option D — Chunk Size / Performance Cleanup

Goal: reduce Vite production chunk warnings.

Likely scope:

- Analyze bundle.
- Split Monaco/PDF/editor routes/components.
- Keep workers local.
- Verify no CSP regression.

## Last Maintainer Notes

- Rust exists at `~/.cargo/bin`; shell did not include it by default. Use `PATH="$HOME/.cargo/bin:$PATH"` for Rust gates or fix shell profile.
- Current source alignment now extends beyond `texforge-prompt-03`; future work should start from `/Users/stefano_ruggiero/Documents/GitHub/LaTeX_Compiler` as canonical repo, not copy files blindly from prompt worktree.
- This handoff file intentionally records local verification only. It does not claim CI or real-machine platform verification.
