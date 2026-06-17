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
- [x] Il workflow GitHub Actions è configurato. I gate locali risultano superati; il run pubblico associato al commit deve essere registrato tramite SHA e Run ID prima di considerare la baseline CI pubblicamente verificata.

### Residui Tecnici Attivi (da `docs/AUDIT.md`)

Sebbene la baseline tecnica sia consolidata sia per TypeScript che per il runtime, sono presenti 6 residui attivi qualificati pre-migrazione con la seguente catalogazione e blocco:

1. **Visibilità Documento in Fase di Distruzione (Gravità Media)** - _Bloccante prima di Tauri_: Il vecchio `pdfDoc` rimane temporaneamente visibile durante gli smantellamenti asincroni, rischiando azioni impreviste dell'utente. Deve essere risolto prioritariamente prima di collegare il backend Tauri nativo.
2. **Copertura Test Carenze PDF (Gravità Media)** - _Bloccante prima di Tauri_: Mancano asserzioni per fallimenti critici sincroni di `getDocument` e riavvii forzati. Cruciale per assicurare la tolleranza ai guasti nell'interfaccia desktop.
3. **Test PdfViewer A → B → C: Verifica Argomenti (Gravità Bassa)** - _Rinviabile alla fase PDF / Sviluppo Viewer_: Il test verifica solo il conteggio delle chiamate a `getDocument` senza asseverare l'argomento esatto dei byte per il file C.
4. **Catch del Rendering: Rigetti non-Error (Gravità Bassa)** - _Rinviabile alla fase PDF / Sviluppo Viewer_: Gestione di rigetti asincroni non tipizzati in errore primario.
5. **Deferred Irrisolte (Gravità Bassa)** - _Rinviabile alla fase PDF / Sviluppo Viewer_: Gestione fine del teardown delle promesse in Vitest.
6. **Controllo Callback Monaco Editor (Gravità Bassa)** - _Rinviabile alle fasi SyncTeX / LSP_: Validazione dettagliata di esecuzione di `onDidChangeModel` in Monaco.

---

## Desktop / Tauri v2 Roadmap (Da Fare)

- [ ] **Fase 1**: Inizializzazione Tauri v2 su macOS Apple Silicon e impostazione del Workspace.
- [ ] **Fase 2**: Implementare storage Rust-based `SQLite` e FileSystem, sostituendo IndexedDB per il Local mode.
- [ ] **Fase 3**: Costruire l'Astrazione in Rust del Compiler per usare nativamente `latexmk` ignorando `HttpFallbackCompiler`.
- [ ] **Fase 4**: Integrare il supporto a SyncTeX in viewer e `texlab` LSP per Monaco editor.
- [ ] **Fase 5**: Sviluppare modulo di Sync LAN zero-config (Yjs basato su proxy Rust P2P).
- [ ] **Fase 6**: Notarizzazione Apple e build locale di distribuzione (`.dmg`).

_Nota: tutte le vecchie fasi che prevedevano l'integrazione Google Auth e consumazione API Drive sono state sospese in favore dello switch ad Architettura Desktop Local-First._
