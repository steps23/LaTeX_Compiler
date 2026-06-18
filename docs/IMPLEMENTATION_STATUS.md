# Implementation Status

## Web/SPA Baseline (Completati)

- [x] Baseline progetto Vite (React 19).
- [x] Monaco Editor con evidenziazione sintattica LaTeX.
- [x] Layout resizable e Sidebar base completati.
- [x] Isolamento store (Zustand) e design architetturale dell'app.
- [x] Typings per errori e contesti render (canvas API).

## Baseline tecnica completata — residui pre-migrazione aperti

- [x] Risolto Type error in `server/auth.ts` (modificato/rimosso).
- [x] Risolto Type error su Monaco in `MonacoEditor.test.tsx` e file accessori.
- [x] Sistemato ESLint e rimozione di errori suppressi in `PdfViewer.tsx`, `main.tsx`, `index.html`.
- [x] Ripulito codice morto (es. variabili non utilizzate).
- [x] Sostituito caricamenti via CDN per Monaco, adozione pura di Worker build integrati.
- [x] Rimossi global suppressions per ResizeObserver.
- [x] Corretti difetti di lifecycle in `PdfViewer`, `BlobViewer` URL Objects leak, restore corretto view state in `MonacoEditor`, strict mode typechecks integrati e rimosse dependency instabili (come name.match non boolean).
- [x] PDF.js localizzato via Vite build senza CDN esterne.
- [x] Il workflow GitHub Actions è configurato. I gate locali risultano superati e il run pubblico 27682061084 associato al commit 6ced5a1ef6852bfdd9840149b7916a1bbd313726 è stato verificato ed è verde.

### Residui Tecnici Attivi (da `docs/AUDIT.md`)

Gli ex-residui PDF sono stati indirizzati tramite estensioni mirate della suite di test e irrobustimento logico del lifecycle. Le verifiche locali confermano la stabilità di questi scenari basata su 41 test automatizzati passanti:

- [x] **Visibilità Documento in Fase di Distruzione (Risolto ✔)**: Azzeramento sincrono istantaneo del vecchio `pdfDoc` prima dello smaltimento asincrono del task.
- [x] **Copertura Test Carenze PDF (Risolto ✔)**: Aggiunta copertura per fallimenti `getDocument`, rimozioni precoci di eventi e lifecycle post-unmount.
- [x] **Test PdfViewer A → B → C: Verifica Argomenti (Risolto ✔)**: Verifica rigorosa con asserzioni sui byte caricati nell'ultima chiamata `getDocument` di C.
- [x] **Catch del Rendering: Rigetti non-Error (Risolto ✔)**: Normalizzazione robusta degli input di rigetto non standard (stringhe, null, oggetti).
- [x] **Deferred Irrisolte (Risolto ✔)**: Chiusura serializzata e pulita di tutte le promesse asincrone deferred nei test suites.

Residui non bloccanti rinviati a fasi successive:

- [ ] **Controllo Callback Monaco Editor (Sospeso / Rinviato)**: Validazione fine di `onDidChangeModel` in Monaco (fasi SyncTeX/LSP).

---

## Desktop / Tauri v2 Roadmap (Da Fare)

- [ ] **Fase 1**: Inizializzazione Tauri v2 su macOS Apple Silicon e impostazione del Workspace.
- [ ] **Fase 2**: Implementare storage Rust-based `SQLite` e FileSystem, sostituendo IndexedDB per il Local mode.
- [ ] **Fase 3**: Costruire l'Astrazione in Rust del Compiler per usare nativamente `latexmk` ignorando `HttpFallbackCompiler`.
- [ ] **Fase 4**: Integrare il supporto a SyncTeX in viewer e `texlab` LSP per Monaco editor.
- [ ] **Fase 5**: Sviluppare modulo di Sync LAN zero-config (Yjs basato su proxy Rust P2P).
- [ ] **Fase 6**: Notarizzazione Apple e build locale di distribuzione (`.dmg`).

_Nota: tutte le vecchie fasi che prevedevano l'integrazione Google Auth e consumazione API Drive sono state sospese in favore dello switch ad Architettura Desktop Local-First._
