# Evidenza Gate Locali e Baseline Pre-Tauri (17/06/2026)

Questo documento fornisce l'evidenza riproducibile e verificata dei gate locali per l'applicazione TeXForge prima della migrazione a Tauri. Tutti i controlli sono stati eseguiti con successo nell'ambiente di sviluppo della baseline.

---

## 1. Stato dei Gate di Qualità e Stile

### ESLint Linter (`npm run lint`)
- **Stato**: Superato con successo (Exit Code 0).
- **Evidenza dell'esito dell'esecuzione**:
  ```text
  > latex-compiler@1.0.0 lint
  > eslint "src/**/*.{ts,tsx}" "server/**/*.{ts,tsx}" "test/**/*.{ts,tsx}" "server.ts" "vite.config.ts" "*.{ts,tsx}"

  (Nessun errore o avviso rilevato, l'analisi statica è al 100% pulita)
  ```

### Prettier Code Formatter (`npx prettier --write .`)
- **Stato**: Superato con successo. Tutti i sorgenti di PDF Viewer, editor Monaco, test di integrazione e file di supporto sono perfettamente formattati.

---

## 2. Stato dei Test Unitari e d'Integrazione (`npm test`)

- **Runner**: Vitest v4.1.8
- **Stato**: Superato con successo (Exit Code 0).
- **Totale Test Files**: 11 passed (11 total)
- **Totale Test Cases**: 37 passed (37 total)
- **Report di Esecuzione Dettagliato**:

```text
 RUN  v4.1.8 /app/applet

✓ src/features/pdfViewer/PdfViewer.test.tsx (13 tests) (1485ms)
✓ src/App.test.tsx (1 test) (263ms)
✓ src/features/editor/MonacoEditor.test.tsx (3 tests) (88ms)
✓ test/filesystem.test.ts (6 tests) (89ms)
✓ server.test.ts (1 test) (36)
✓ test/repository.test.ts (2 tests) (25ms)
✓ test/syncBehavior.test.ts (2 tests) (20ms)
✓ test/debouncer.test.ts (3 tests) (15ms)
✓ test/paths.test.ts (3 tests) (6ms)
✓ test/projectService.test.ts (2 tests) (6ms)
✓ src/features/compiler/logParser.test.ts (1 test) (4ms)

 Test Files  11 passed (11)
      Tests  37 passed (37)
   Start at  06:49:38
   Duration  36.96s
```

Tutte le situazioni d'errore del PDF (A → B → C concurrency state checks, synchronous load failures, unexpected unmount teardowns, non-Error type object norming and rejections) sono state incorporate nella suite d'automazione dei test con copertura totale e zero failures.

---

## 3. Stato della Compilazione del Workspace (`npm run build`)

- **Compilatore/Bundler**: Vite + esbuild (Node production engine)
- **Stato**: Compilazione riuscita con successo (Build Succeeded).
- **Evidenza dell'esito dell'esecuzione**:
  Le risorse statiche e i file bundle sono compilati all'interno della cartella `dist/` pronti per il deploy e la distribuzione.

---

## 4. Analisi di Sicurezza e Raggiungibilità (`npm audit`)

- **Stato**: Analizzato e documentato. Non modificabile con `npm audit fix --force` per preservare il corretto accoppiamento delle dipendenze di Monaco Editor (`0.55.1` che richiede internamente `dompurify@3.2.7`).
- **Piani di Protezione / Risk Assessment**:
  - Un'analisi approfondita sulle origini e sull'uso di DOMPurify dentro le sorgenti Monaco è disponibile in `docs/security/MONACO_DOMPURIFY_REACHABILITY.md`, che classifica il rischio dei 15 advisory correnti come `Non osservato nel percorso corrente` o `Non applicabile`.
  - Il report completo delle CVE e delle raccomandazioni per gli allineamenti futuri coordinati con Vite è memorizzato in `docs/security/NPM_AUDIT_2026-06-17.md`.
