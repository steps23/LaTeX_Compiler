# Implementation Status

## Web/SPA Baseline (Completati)

- [x] Baseline progetto Vite (React 19).
- [x] Monaco Editor con evidenziazione sintattica LaTeX.
- [x] Layout resizable e Sidebar base completati.
- [x] Isolamento store (Zustand) e design architetturale dell'app.
- [x] Typings per errori e contesti render (canvas API).

## Debito Tecnico Pre-Migrazione (Completato)

- [x] Risolto Type error in `server/auth.ts` (modificato/rimosso).
- [x] Risolto Type error su Monaco in `MonacoEditor.test.tsx` e file accessori.
- [x] Sistemato ESLint e rimozione di errori suppressi in `PdfViewer.tsx`, `main.tsx`, `index.html`.
- [x] Ripulito codice morto (es. variabili non utilizzate).
- [x] Sostituito caricamenti via CDN per Monaco, adozione pura di Worker build integrati.
- [x] Rimossi global suppressions per ResizeObserver.
- [x] Corretti difetti di lifecycle in `PdfViewer`, `BlobViewer` URL Objects leak, restore corretto view state in `MonacoEditor`, strict mode typechecks integrati e rimosse dependency instabili (come name.match non boolean).
- [x] PDF.js localizzato via Vite build senza CDN esterne.
- [x] GitHub Action configurata e test pre-push passati nell'ambiente di sviluppo locale. (L'esito e il Run ID del workflow pubblico associato al commit non sono confermabili direttamente in quanto non esiste un runner di autenticazione `gh` CLI nell'ambiente dell'agente).

## Desktop / Tauri v2 Roadmap (Da Fare)

- [ ] **Fase 1**: Inizializzazione Tauri v2 su macOS Apple Silicon e impostazione del Workspace.
- [ ] **Fase 2**: Implementare storage Rust-based `SQLite` e FileSystem, sostituendo IndexedDB per il Local mode.
- [ ] **Fase 3**: Costruire l'Astrazione in Rust del Compiler per usare nativamente `latexmk` ignorando `HttpFallbackCompiler`.
- [ ] **Fase 4**: Integrare il supporto a SyncTeX in viewer e `texlab` LSP per Monaco editor.
- [ ] **Fase 5**: Sviluppare modulo di Sync LAN zero-config (Yjs basato su proxy Rust P2P).
- [ ] **Fase 6**: Notarizzazione Apple e build locale di distribuzione (`.dmg`).

_Nota: tutte le vecchie fasi che prevedevano l'integrazione Google Auth e consumazione API Drive sono state sospese in favore dello switch ad Architettura Desktop Local-First._
