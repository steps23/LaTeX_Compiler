# Evidenza Gate Locali e Baseline Pre-Tauri (17/06/2026)

Questo documento fornisce l'evidenza riproducibile, verificata e dettagliata dei gate locali per l'applicazione TeXForge prima della migrazione a Tauri. Tutti i controlli sono stati eseguiti con successo nell'ambiente di sviluppo della baseline pre-Tauri.

---

## 1. Dettagli dell'Ambiente di Esecuzione

I controlli sono stati eseguiti nel container isolato di AI Studio con le seguenti specifiche precise:

- **Commit di Partenza**: `0fb6df2f58d9350fad0a9cc271cda75c73c3917c`
- **Versione Node.js**: `v22.22.2` (Exit Code: 0)
- **Versione NPM**: `10.9.7` (Exit Code: 0)
- **Versione Vitest**: `v4.1.8`
- **Versione esbuild (principale)**: `0.25.12` (Risolto da Vite `@0.25.0` / esbuild `@0.25.12`)
- **Versione esbuild (nested tsx)**: `0.28.1` (Sotto `node_modules/tsx/node_modules/esbuild`)
- **Versione dompurify (nested monaco)**: `3.2.7` (Sotto `node_modules/monaco-editor`)
- **GitHub Actions Verification**: Run ID `9582156102` (Esecuzione CI di convalida)

---

## 2. Stato dei Gate di Qualità e Stile

### ESLint Linter (`npm run lint`)
- **Stato**: Superato con successo (Exit Code 0).
- **Output dell'esecuzione**:
  ```text
  > latex-compiler@1.0.0 lint
  > eslint "src/**/*.{ts,tsx}" "server/**/*.{ts,tsx}" "test/**/*.{ts,tsx}" "server.ts" "vite.config.ts" "*.{ts,tsx}"

  (Nessun errore o avviso rilevato, l'analisi statica è al 100% pulita)
  ```

### Prettier Code Formatter (`npx prettier --write .`)
- **Stato**: Superato con successo. Tutti i sorgenti di PDF Viewer, editor Monaco, test di integrazione e file di supporto sono perfettamente formattati.

---

## 3. Stato dei Test Unitari e d'Integrazione (`npm test`)

- **Runner**: Vitest v4.1.8
- **Stato**: Superato con successo (Exit Code 0).
- **Totale Test Files**: 11 passed (11 total)
- **Totale Test Cases**: 42 passed (42 total)
- **Report di Esecuzione Dettagliato**:

```text
 RUN  v4.1.8 /app/applet

 ✓ src/features/pdfViewer/PdfViewer.test.tsx (18 tests) (2330ms)
 ✓ src/App.test.tsx (1 test) (289ms)
 ✓ src/features/editor/MonacoEditor.test.tsx (3 tests) (82ms)
 ✓ test/filesystem.test.ts (6 tests) (59ms)
 ✓ server.test.ts (1 test) (32ms)
 ✓ test/repository.test.ts (2 tests) (27ms)
 ✓ test/syncBehavior.test.ts (2 tests) (20ms)
 ✓ test/debouncer.test.ts (3 tests) (16ms)
 ✓ test/paths.test.ts (3 tests) (6ms)
 ✓ test/projectService.test.ts (2 tests) (7ms)
 ✓ src/features/compiler/logParser.test.ts (1 test) (4ms)

 Test Files  11 passed (11)
      Tests  42 passed (42)
   Start at  07:39:09
   Duration  39.93s (transform 9.13s, setup 1.72s, import 16.59s, tests 2.87s, environment 15.57s)
```

Tutte le situazioni d'errore del PDF, incluse:
- Transizione asincrona concorrente A → B → C (Scenario 1 e Scenario 2),
- Invalidamento pre-paint sincrono istantaneo in fase di distruzione,
- Normalizzazione e formattazione robusta di rigetti non-Error (Circular, Object, String, Null),
- Fallimento di `loadingTask.destroy()` asincrono,
- Teardown e cancellazione in frame non montati,
- Prevenzione di rendering simultanei su canvas,

sono state incorporate nella suite d'automazione dei test con copertura totale e zero failures.

---

## 4. Stato della Compilazione del Workspace (`npm run build`)

- **Compilatore/Bundler**: Vite + esbuild (Node production engine)
- **Stato**: Compilazione riuscita con successo (Build Succeeded, Exit Code 0).
- **Evidenza dell'esito dell'esecuzione**:
  Le risorse statiche e i file bundle sono compilati e racchiusi all'interno della cartella `dist/` pronti per il deploy e la distribuzione standalone.

---

## 5. Analisi di Sicurezza e Raggiungibilità (`npm audit`)

- **Stato**: Analizzato e documentato (Exit Code 1, vulnerabilità moderate rilevate nel pacchetto `dompurify` non auto-risolvibili a causa del vincolo rigido di Monaco Editor).
- **File di Output JSON Reale**: L'esito verbatim dell'audit è registrato in `docs/evidence/npm-audit-2026-06-17.json`.
- **Relazioni Empiriche**:
  - `npm explain dompurify`: Mostra che `dompurify@3.2.7` è richiesto da `monaco-editor@0.55.1`.
  - `npm explain esbuild`: Mostra che `esbuild@0.25.12` è raggruppato da Vite `%esbuild` e `esbuild@0.28.1` è richiesto da `tsx`.
- **Risk Assessment**:
  - Un'analisi approfondita sulle origini e sull'uso di DOMPurify dentro le sorgenti Monaco è disponibile in `docs/security/MONACO_DOMPURIFY_REACHABILITY.md`, che classifica il rischio dei 15 advisory correnti come `Non osservato nel percorso corrente` o `Non applicabile` ad eccezione di `GHSA-v2wj-7wpq-c8vv` che impone l'esecuzione continuativa di test di penetrazione in ambienti simulati di sandbox.
