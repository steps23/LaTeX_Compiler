# Project Handoff Status

Date: 2026-06-22
Project: TeXForge / LaTeX_Compiler
Repository: `/Users/stefano_ruggiero/Documents/GitHub/LaTeX_Compiler`
Reference worktree/prompt source: `/Users/stefano_ruggiero/Documents/LaTeX app/texforge-prompt-03`

## Current Summary

The repository source files are aligned with the `texforge-prompt-03` reference worktree. No source changes were required during the latest verification pass.

Status: `verificato localmente`

Latest phase added: Prompt 5 baseline — local TeX runtime diagnostics.

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
- Local TeX runtime diagnostic contract v1 is implemented.
- Rust detects allowlisted TeX tools from process `PATH` and known platform TeX directories without invoking a shell.
- LaTeX Environment screen is available at `#/tex-environment` from the dashboard.

## Latest Verification

Run from:

```bash
cd /Users/stefano_ruggiero/Documents/GitHub/LaTeX_Compiler
```

### Source Alignment

```bash
diff -qr --exclude='.git' --exclude='node_modules' --exclude='dist' --exclude='target' --exclude='.DS_Store' \
  '/Users/stefano_ruggiero/Documents/LaTeX app/texforge-prompt-03' \
  '/Users/stefano_ruggiero/Documents/GitHub/LaTeX_Compiler'
```

Result: no source differences.

### Frontend Gate

```bash
npm run check:all
```

Result: passed.

Evidence:

- Prettier format check passed.
- TypeScript typecheck passed.
- ESLint passed.
- Vitest passed: 16 test files, 58 tests.
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
- `cargo test --manifest-path src-tauri/Cargo.toml` passed: 7 tests.
- `cargo check --manifest-path src-tauri/Cargo.toml` passed.

### Git State

```bash
git status --short
```

Result before this handoff file: clean.

After this handoff file: this file is the only intended new change.

## External Documentation Checked

Authoritative/current docs were checked through Context7:

- Tauri v2 docs: `/websites/v2_tauri_app`
- Vite v6 docs: `/websites/v6_vite_dev`
- Topics checked:
  - Tauri 2 capabilities and `core:default`
  - Tauri Rust command invocation/state/security and shell risk guidance
  - window-state plugin setup
  - app-data/security-related patterns
  - Vite build/code-splitting guidance for known bundle warnings

Relevant alignment:

- `src-tauri/capabilities/default.json` grants only `core:default`.
- `src-tauri/Cargo.toml` includes `tauri-plugin-window-state = "2"`.
- Storage uses app data directory through Tauri path API in Rust, not broad frontend filesystem access.

## Important Files

- `README.md` — project overview, browser/desktop usage, quality gates, limitations.
- `AGENTS.md` — repository work rules and required checks.
- `docs/IMPLEMENTATION_STATUS.md` — status matrix for Prompt 3 and Prompt 4.
- `docs/SUPPORT_MATRIX.md` — platform/evidence matrix.
- `docs/ARCHITECTURE.md` — architecture overview.
- `src-tauri/tauri.conf.json` — Tauri build/dev/CSP/window config.
- `src-tauri/capabilities/default.json` — Tauri permissions.
- `src-tauri/src/lib.rs` — Rust IPC commands and storage backend.
- `src-tauri/src/tex_runtime.rs` — bounded TeX runtime/tool detection.
- `src/utils/texRuntime.ts` — frontend TeX runtime diagnostic contract.
- `src/features/texEnvironment/TexEnvironment.tsx` — LaTeX Environment diagnostics UI.
- `src/` — React/Vite frontend.
- `test/` and `src/**/*.test.tsx` — frontend/unit tests.

## What Remains / Deferred Work

The app is not yet a fully offline production desktop LaTeX editor. Deferred or incomplete areas:

- Runtime selection and per-project TeX runtime settings.
- Real distribution verification on Windows/Linux and installed-app smoke tests.
- Offline/local LaTeX compilation.
- SyncTeX support.
- PDF source/preview synchronization.
- texlab/LSP integration.
- SQLite metadata storage; current desktop metadata uses JSON manifests in app-data project directories.
- Collaboration features.
- Git integration.
- Security audit beyond local least-privilege checks.
- Installer signing/notarization.
- Auto-updater.
- Real-machine verification on Windows x64.
- Real-machine verification on Linux x64.
- macOS Intel verification.
- CI verification for the current desktop matrix.
- Cross-platform installed-app smoke tests.
- Performance tuning/code splitting for large frontend chunks.

## Known Constraints

- Do not grant global filesystem access.
- Do not add generic shell execution from the frontend.
- Keep React/TypeScript and Rust separated through typed contracts.
- Keep platform-specific code behind adapters.
- Do not claim cross-platform support unless verified on target OS/hardware or CI runner.
- Desktop mode must not require Express/web server runtime beyond Vite dev server during development.
- Remote HTTP compiler fallback still exists; do not describe app as offline-first until local compilation lands.

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

Goal: add global and per-project TeX runtime selection after diagnostic baseline.

Likely scope:

- Persistent runtime selection settings.
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

Prerequisite: Option A or equivalent detection contract.

Likely scope:

- Job workspace under app-managed temp/cache directory.
- Strict command allowlist.
- Timeout and output size limits.
- PDF/artifact collection.
- Error log parsing baseline.
- Tests for path validation and command bounds.

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
- Current source alignment with `texforge-prompt-03` means future work should start from `/Users/stefano_ruggiero/Documents/GitHub/LaTeX_Compiler` as canonical repo, not copy files blindly from prompt worktree.
- This handoff file intentionally records local verification only. It does not claim CI or real-machine platform verification.
