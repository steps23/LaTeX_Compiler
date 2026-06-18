# Architecture Overview

L'applicazione è un editor LaTeX inizialmente in formato SPA (Single Page Application) sviluppata con React e Vite, e ora architettata come un'app Desktop Tauri v2 dual-runtime.

## Struttura

- `src/state`: Contiene gli store globali gestiti con zustand per gestire i file e la compilazione.
- `src/features/compiler`: Motore astrazione per la conversione di codice sorgente LaTeX in file PDF.
- `src/features/editor`: Componente editor Monaco configurato per sintassi LaTeX.
- `src/features/pdfViewer`: Gestione dell'anteprima PDF renderizzata via web workers (`pdfjs-dist`).
- `src/utils/runtime.ts`: Adapter che individua se l'ambiente di esecuzione è il browser o il worker Webview nativo di Tauri. Usa IPC sicuro per la comunicazione col backend Rust.
- `src-tauri`: Il backend nativo Rust (`aarch64-apple-darwin`), costruito con Tauri v2. Fornisce capacità restrittive (Least Privilege) per finestre, alert dialogs, system process opening e session state restoration.
- `server.ts`: Server Express usato unicamente per la visualizzazione/test della modalità Browser web e fallback di sviluppo. La compilazione Tauri desktop non ne fa uso.

## Database & Local-First Architecture

- `src/db/core.ts` & `src/db/repository.ts`: Interfacciamento robusto ad IndexedDB per i dati offline, isolato dai layer visivi.
- **SyncQueue & Soft-Delete**: Predisposizione di una coda asincrona isolata nel database (completamente atomica insieme all'aggiornamento dei file e i metadata). Le transazioni `deleteWithSyncOp` e simili mantengono una "tombstone" finché non sincronizzata per i progetti Cloud (la coda attualmente attende lo sviluppo dei worker OAuth).

Manca l'integrazione Google Auth e Sync API.
La compilazione avviene al momento inviando il sorgente via network ad una sandbox LaTeX online (CGI compatibile).
