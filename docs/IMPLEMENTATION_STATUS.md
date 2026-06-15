# Implementation Status

## Completati
- [x] Baseline progetto Vite (React 19).
- [x] Astrazione Compiler e Worker PDF per l'anteprima.
- [x] Monaco Editor con evidenziazione sintattica LaTeX.
- [x] Layout resizable con \`react-resizable-panels\`.
- [x] Esecuzione di ESLint e Prettier per format pulito.
- [x] Eliminazione dei log e proxy ResizeObserver pericolosi in favore dell'EventListener.
- [x] ErrorBoundary globale tipizzato.
- [x] Typings per errori e contesti render (canvas API).
- [x] Modello Dati Local-First Predisposto per Sync. Code e IDB upgrade non bloccante testate.
- [x] Isolamento store e repository, con File Debouncer integrato nella lifecycle.

## Da Fare / Futuri Sviluppi
- [ ] Implementazione integrazione di Google Auth (OAuth).
- [ ] Implementazione Google Drive (consumo della syncQueue e API remote).
- [ ] Compilazione locale via WebAssembly offline (placeholder / WIP nel codice ma mai attivato).
- [ ] Live collaboration.
