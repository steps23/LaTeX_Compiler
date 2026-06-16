# Audit Report

Data: L'audit è stato completato per stabilizzare la base di codice e rimuovere eventuali debito tecnico iniziale.

## Problematiche risolte

- `package.json`: Aggiunti nomi corretti, script formali (lint, typecheck, format, build) e risolto un problema di dipendenze duplicate.
- **Tipizzazione**: Rimossi tutti gli `any` non sicuri convertendoli a \`unknown\` e type casting sicuro.
- **Errori globali non gestiti**:
  - `ResizeObserver` error limit loop risolto a livello finestra per non inquinare la console.
  - Rimossa la sovrascrittura di classe di \`ResizeObserver\` e di \`console.error\` (considerato bad practice).
- **ESLint & Prettier**: Configurazione formale introdotta e formattazione eseguita per intero sull'applicazione.
- **Zod**: Introdotto uno schema di base per validare le variabili d'ambiente (usato in `env.ts` e consumato da `server.ts`).
- **React**: Implementato un vero `ErrorBoundary` globale per limitare i crash dei componenti.
- **Dipendenze rimosse**: Nessuna eccetto le correzioni a livello `devDependencies`, tutti i task previsti per il baseline sono completati.

## Architettura Sync & Google Drive

- È stato introdotto un livello di astrazione del database Local-First (`ProjectStorageMode`, `SyncQueue`, etc.).
- I progetti `local-only` **non creano** operazioni di sync nella coda.
- I file associati a Drive utilizzano soft-delete (`deletedAt`) e le code atomiche tramite operazione `delete-file` della transazione per garantire consistenza futura.
- Nota: la coda `syncQueue` non viene attualmente consumata. L'integrazione Google Auth e Syncing con le vere API Drive non è ancora implementata.

L'applicazione adesso compila e subisce l'esecuzione di test pulita.

## Stabilizzazione Baseline

- Risolto memory leak in `PdfViewer.tsx` causato dalla mancata cancellazione progressiva e ordinata dei task asincroni (`loadingTask` e `renderTask`). Implementato lifecycle completamente serializzato.
- Rimossa la dipendenza esterna unpkg CDN del worker di `pdfjs-dist` rendendo l'import gestito interamente da Vite localmente.
- Risolto difetto nel `onDidChangeModel` di Monaco, simulando il vero cambio prop di file e validando gli effettivi store.
- Implementati test rigorosi che coprono il workflow completo Monaco `f1 -> f2 -> f1` e validano l'effettivo ripristino di `ICodeEditorViewState`.
- I test di CI (linting, test unitari, e check type) sono stati passati con successo nell'ambiente sandbox dell'agente. Il workflow GitHub Actions è configurato, ma il relativo run pubblico non è stato ancora verificato.
