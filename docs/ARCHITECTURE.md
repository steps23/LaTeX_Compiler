# Architecture Overview

L'applicazione è un editor online per LaTeX in formato SPA (Single Page Application) sviluppato con React e Vite.

## Struttura

- \`src/state\`: Contiene gli store globali gestiti con zustand per gestire i file e la compilazione.
- \`src/features/compiler\`: Motore astrazione per la conversione di codice sorgente LaTeX in file PDF in formato Uint8Array tramite HTTP fallback.
- \`src/features/editor\`: Componente editor Monaco configurato per sintassi LaTeX.
- \`src/features/pdfViewer\`: Gestione dell'anteprima PDF renderizzata via web workers (\`pdfjs-dist\`).
- \`server.ts\`: Server Express che avvolge l'SPA per il development e gestisce i proxy sicuri (come CORS per la compilazione). Serve la directory compilata in produzione.

## Database & Local-First Architecture

- `src/db/core.ts` & `src/db/repository.ts`: Interfacciamento robusto ad IndexedDB per i dati offline, isolato dai layer visivi.
- **SyncQueue & Soft-Delete**: Predisposizione di una coda asincrona isolata nel database (completamente atomica insieme all'aggiornamento dei file e i metadata). Le transazioni `deleteWithSyncOp` e simili mantengono una "tombstone" finché non sincronizzata per i progetti Cloud (la coda attualmente attende lo sviluppo dei worker OAuth).

Manca l'integrazione Google Auth e Sync API.
La compilazione avviene al momento inviando il sorgente via network ad una sandbox LaTeX online (CGI compatibile).
