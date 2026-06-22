# Rust and Tauri instructions

- Keep Tauri capabilities least-privilege.
- Do not add global filesystem permissions.
- Do not expose arbitrary shell commands to the frontend.
- Use `#[cfg(target_os = "...")]` only in platform adapters.
- Prefer typed serializable structs over unstructured JSON at IPC boundaries.
- Avoid avoidable `unwrap` and `expect` in runtime code.
- Run Rust gates before claiming native changes are complete.
- Do not claim macOS, Windows or Linux support unless each target was built or tested on a native runner or machine.
