# TeXForge repository instructions

## Target

TeXForge is a Tauri 2 desktop app targeting:

- macOS Apple Silicon and Intel;
- Windows x86-64;
- Linux x86-64.

## Work rules

- Execute one prompt or phase per task.
- Stop when the current phase acceptance criteria pass.
- Read README, architecture docs, implementation status, roadmap, ADRs and the relevant prompt before editing.
- Compare documentation claims with the real code before relying on them.
- Keep React/TypeScript and Rust separated through typed contracts.
- Isolate platform-specific code behind adapters.
- Do not use generic shell execution from the frontend.
- Do not grant global filesystem access.
- Do not add runtime dependencies on a web server for desktop mode.
- Do not claim cross-platform support from a single-platform check.

## Status labels

Classify outcomes as one of:

- predisposto;
- verificato localmente;
- verificato in CI;
- verificato su macchina reale;
- non verificato.

## Frontend gates

- `npm ci`
- `npm run format:check`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run check:all`

## Rust/Tauri gates

- `cargo fmt --check --manifest-path src-tauri/Cargo.toml`
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `npm run tauri:build -- --debug` when a native build is in scope.

## Git

- Do not commit, push, merge or open PRs unless explicitly requested.
- Do not use `reset --hard`, `clean -fd` or force push.
- Do not modify files unrelated to the current phase.
