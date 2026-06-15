# Implementation Status

## Web/SPA Baseline (Completati)

- [x] Baseline progetto Vite (React 19).
- [x] Monaco Editor con evidenziazione sintattica LaTeX.
- [x] Layout resizable e Sidebar base completati.
- [x] Isolamento store (Zustand) e design architetturale dell'app.
- [x] Typings per errori e contesti render (canvas API).

## Debito Tecnico Pre-Migrazione (DA FARE PRIMA DI PROCEDERE)

- [ ] Risolvere un Type error in `server/auth.ts` su `S256`.
- [ ] Risolvere Type error su Monaco in `MonacoEditor.tsx`.
- [ ] Sistemare 1 Errore ESLint gravoso (`set-state-in-effect`) in `AuthStatus.tsx`.
- [ ] Ripulire codice morto e warning imports dal core UI.

## Desktop / Tauri v2 Roadmap (Da Fare)

- [ ] **Fase 1**: Inizializzazione Tauri v2 su macOS Apple Silicon e impostazione del Workspace.
- [ ] **Fase 2**: Implementare storage Rust-based `SQLite` e FileSystem, sostituendo IndexedDB per il Local mode.
- [ ] **Fase 3**: Costruire l'Astraziore in Rust del Compiler per usare nativamente `latexmk` ignorando `HttpFallbackCompiler`.
- [ ] **Fase 4**: Integrare il supporto a SyncTeX in viewer e `texlab` LSP per Monaco editor.
- [ ] **Fase 5**: Sviluppare modulo di Sync LAN zero-config (Yjs basato su proxy Rust P2P).
- [ ] **Fase 6**: Notarization Apple e build locale di distribuzione (`.dmg`).

_Nota: tutte le vecchie fasi che prevedevano l'integrazione Google Auth e consumazione API Drive sono state sopsese (abbandonate) in favore dello switch ad Architettura Desktop Offline-First._
