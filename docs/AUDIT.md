# Audit Report

Data: L'audit è stato completato per stabilizzare la base di codice e rimuovere eventuale debito tecnico iniziale.

## Problematiche risolte

- `package.json`: Aggiunti nomi corretti, script formali (lint, typecheck, format, build) e risolto un problema di dipendenze duplicate.
- **Tipizzazione**: Rimossi tutti gli `any` non sicuri convertendoli a `unknown` e type casting sicuro.
- **Errori globali non gestiti**:
  - `ResizeObserver` error limit loop risolto a livello finestra per non inquinare la console.
  - Rimossa la sovrascrittura di classe di `ResizeObserver` e di `console.error` (considerato bad practice).
- **ESLint & Prettier**: Configurazione formale introdotta e formattazione eseguita per intero sull'applicazione.
  - **Nota ESLint 9**: L'adozione di ESLint 9 è stata registrata come una decisione tecnica ed architetturale persistente, non un downgrade temporaneo.
- **Zod**: Introdotto uno schema di base per validare le variabili d'ambiente (usato in `env.ts` e consumato da `server.ts`).
- **React**: Implementato un vero `ErrorBoundary` globale per limitare i crash dei componenti.
- **Dipendenze rimosse**: Nessuna eccetto le correzioni a livello `devDependencies`, tutti i task previsti per il baseline sono completati.

## Architettura Sync & Google Drive

- È stato introdotto un livello di astrazione del database Local-First (`ProjectStorageMode`, `SyncQueue`, etc.).
- I progetti `local-only` **non creano** operazioni di sync nella coda.
- I file associati a Drive utilizzano soft-delete (`deletedAt`) e le code atomiche tramite operazione `delete-file` della transazione per garantire consistenza futura.
- Nota: la coda `syncQueue` non viene attualmente consumata. L'integrazione Google Auth e Syncing con le vere API Drive non è ancora implementata.

L'applicazione adesso compila e i test vengono eseguiti senza errori.

## Stabilizzazione Baseline

- Risolto memory leak in `PdfViewer.tsx` causato dalla mancata cancellazione progressiva e ordinata dei task asincroni (`loadingTask` e `renderTask`). Implementato lifecycle completamente serializzato.
- Rimossa la dipendenza esterna unpkg CDN del worker di `pdfjs-dist` rendendo l'import gestito interamente da Vite localmente.
- Risolto difetto nel `onDidChangeModel` di Monaco, simulando il vero cambio prop di file e validando gli effettivi store.
- Implementati test rigorosi che coprono il workflow completo Monaco `f1 -> f2 -> f1` e validano l'effettivo ripristino di `ICodeEditorViewState`.
- I test di CI (linting, test unitari, e controllo dei tipi) sono stati passati con successo nell'ambiente sandbox dell'agente. Il workflow GitHub Actions è configurato, ma il relativo run pubblico non è stato ancora verificato.

## Residui del Baseline (Da Classificare)

Di seguito l'audit dei residui attuali dell'applicazione pre-Tauri, con le rispettive valutazioni e fasi consigliate per la risoluzione.

### 1. Test PdfViewer A → B → C: Verifica Argomenti
- **Descrizione**: Il test verifica solo il numero complessivo delle chiamate a `getDocument` (che siano 2) senza asserire che la seconda riceva realmente i byte del file C.
- **Gravità**: Bassa.
- **Impatto**: Refactoring e modifiche al codice testuale.
- **Probabilità**: Molto probabile che il componente stia gestendo i byte giusti, ma il test ha una lacuna.
- **Test Mancante**: Aggiunta di expectation sull'argomento dell'ultima chiamata.
- **Fase Consigliata**: Fase di Stabilizzazione Pre-Tauri oppure durante Fase 4.

### 2. Visibilità Documento in Fase di Distruzione
- **Descrizione**: Il vecchio `pdfDoc` rimane attivo nell'interfaccia mentre il nuovo task attende la distruzione asincrona del task precedente, aprendo al rischio che un utente interagisca o riavvii un rendering su un documento obsoleto avviato verso il dismount.
- **Gravità**: Media.
- **Impatto**: Possibili errori a runtime causati da tentativi di render su page worker distrutti.
- **Probabilità**: Bassa in cicli di compilazione normali, media per utenti veloci.
- **Test Mancante**: Simulazione di interazione utente (zoom/scroll) durante la pendenza della Promise di distruzione.
- **Fase Consigliata**: Fase di Stabilizzazione Pre-Tauri.

### 3. Catch del Rendering: Rigetti non-Error
- **Descrizione**: Se `renderDeferred.reject()` dovesse intercettare e scatenare un errore non associato all'istanza `Error`, il catch fallirebbe la sua traduzione.
- **Gravità**: Bassa.
- **Impatto**: Il messaggio d'errore fallirebbe il display nella UI e l'eccezione potrebbe diffondersi.
- **Probabilità**: Rara, il layer libreria è tipicamente affidabile nel rilanciare strutture stringa o oggetti Error validi.
- **Test Mancante**: Reject con string type, `null`, object generico.
- **Fase Consigliata**: Fase di Stabilizzazione Pre-Tauri.

### 4. Deferred Irrisolte
- **Descrizione**: Alcune Deferred esplicite rimangono irrisolte al termine dell'unmount del componente all'interno dei test asincroni, creando un teardown impuro.
- **Gravità**: Bassa.
- **Impatto**: Test legati alla validazione memory leak rischiano warning asincroni o overhead del runner Vitest.
- **Probabilità**: Frequente nei branch asincroni dei test correnti.
- **Test Mancante**: Validazioni di garbage collection fine cycle in test runner context.
- **Fase Consigliata**: Fase di Stabilizzazione Pre-Tauri.

### 5. Copertura Test Carenze PDF
- **Descrizione**: Errori sincroni in getDocument, fallimento hard di `loadingTask.destroy()`, gestione `PromiseCancelledException` in fetch phase e controlli che i `setState` non operino dopo unmount restano inesplorati.
- **Gravità**: Media.
- **Impatto**: Maggiore rischio di false confidence della code quality basata solo sulla coverage formale di render success rate.
- **Probabilità**: Possibile a fronte di worker falliti da limiti memoria Chrome o network issue locale.
- **Test Mancante**: Simulazione unmount e assertion sui mock di console warn per detectare rendering actions.
- **Fase Consigliata**: Fase di Stabilizzazione Pre-Tauri.

### 6. Controllo Callback Monaco Editor
- **Descrizione**: Il test Monaco testa la result formale e non i flow intermedi di esecuzione di `onDidChangeModel` per validarne tempi ed indici delle chiamate.
- **Gravità**: Bassa.
- **Impatto**: Nessuno pratico sull'output ma disaccoppiamento dalle promesse comportamentali del lifecycle di React nel proxy Editor.
- **Probabilità**: Estremamente rara, trattandosi di un wrapper.
- **Test Mancante**: Hook su `onDidChangeModel` count tracking check.
- **Fase Consigliata**: Fase di Stabilizzazione Pre-Tauri.
