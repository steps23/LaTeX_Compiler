# React and TypeScript instructions

- Use typed adapters for every Tauri IPC boundary.
- Keep browser and desktop behavior behind `src/utils/runtime.ts` or feature-level adapters.
- Preserve browser preview mode for tests and demos.
- Do not call Tauri globals directly from arbitrary components.
- Do not add remote scripts, remote workers, remote fonts or CDN assets.
- Keep Monaco and PDF.js worker configuration local and testable.
- Add or update focused Vitest coverage for changed frontend behavior.
