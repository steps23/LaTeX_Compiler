# Prompt 3 Support Matrix

This matrix records evidence, not release support.

| System                  | Architecture / target                  | Webview       | TeX distribution                                       | Build                                         | Automated tests                | Manual / installed app |
| ----------------------- | -------------------------------------- | ------------- | ------------------------------------------------------ | --------------------------------------------- | ------------------------------ | ---------------------- |
| macOS 26.5.1 local host | Apple Silicon / `aarch64-apple-darwin` | WKWebView     | Detection implemented; local distribution not asserted | Debug app and DMG built locally               | Local frontend/Rust tests      | Pending final smoke    |
| macOS CI                | Apple Silicon / `aarch64-apple-darwin` | WKWebView     | Detection tests pass; real distribution not asserted   | `.app` debug build passed on `macos-15`       | CI passed in run `28040181526` | Non verificato         |
| macOS CI                | Intel / `x86_64-apple-darwin`          | WKWebView     | Detection tests pass; real distribution not asserted   | `.app` debug build passed on `macos-15-intel` | CI passed in run `28040181526` | Non verificato         |
| Windows CI              | x64 / `x86_64-pc-windows-msvc`         | WebView2      | Detection tests pass; real distribution not asserted   | Debug build passed on `windows-2022`          | CI passed in run `28040181526` | Non verificato         |
| Ubuntu CI               | x64 / `x86_64-unknown-linux-gnu`       | WebKitGTK 4.1 | Detection tests pass; real distribution not asserted   | Debug build passed on `ubuntu-22.04`          | CI passed in run `28040181526` | Non verificato         |

CI run `28040181526` is evidence for source gates, native target checks and unsigned debug app/build compatibility only. It is not evidence for manual interaction, installed-app smoke, real TeX distribution presence, installer signing, notarization or updater behavior.

Prompt 5 baseline adds local TeX runtime diagnostics only. CI covers fixture-based detection behavior across macOS, Windows and Linux, but does not yet verify real TeX distributions on Windows/Linux, does not select runtimes and does not compile locally.
