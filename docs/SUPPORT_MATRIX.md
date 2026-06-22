# Prompt 3 Support Matrix

This matrix records evidence, not release support.

| System                  | Architecture / target                  | Webview       | TeX distribution                                       | Build                           | Automated tests           | Manual / installed app |
| ----------------------- | -------------------------------------- | ------------- | ------------------------------------------------------ | ------------------------------- | ------------------------- | ---------------------- |
| macOS 26.5.1 local host | Apple Silicon / `aarch64-apple-darwin` | WKWebView     | Detection implemented; local distribution not asserted | Debug app and DMG built locally | Local frontend/Rust tests | Pending final smoke    |
| macOS CI                | Apple Silicon / `aarch64-apple-darwin` | WKWebView     | Detection predisposto                                  | Predisposto on `macos-15`       | Predisposto               | Non verificato         |
| macOS CI                | Intel / `x86_64-apple-darwin`          | WKWebView     | Detection predisposto                                  | Predisposto on `macos-15-intel` | Predisposto               | Non verificato         |
| Windows CI              | x64 / `x86_64-pc-windows-msvc`         | WebView2      | Detection predisposto for TeX Live/MiKTeX              | Predisposto on `windows-2022`   | Predisposto               | Non verificato         |
| Ubuntu CI               | x64 / `x86_64-unknown-linux-gnu`       | WebKitGTK 4.1 | Detection predisposto for system/user TeX Live         | Predisposto on `ubuntu-22.04`   | Predisposto               | Non verificato         |

No Prompt 3 Windows or Linux test is represented as a real-machine, installed-app or manual test. Installer formats are deferred.

Prompt 5 baseline adds local TeX runtime diagnostics only. It does not yet verify real TeX distributions on Windows/Linux, does not select runtimes and does not compile locally.
