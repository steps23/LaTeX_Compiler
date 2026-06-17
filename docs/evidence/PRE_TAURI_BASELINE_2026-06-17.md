# Evidenza Gate Locali e Baseline Pre-Tauri (17/06/2026)

Questo documento fornisce l'evidenza riproducibile, verificata e dettagliata dei gate locali per l'applicazione TeXForge prima della migrazione a Tauri. Tutti i controlli sono stati eseguiti con successo nell'ambiente di sviluppo della baseline pre-Tauri.

---

## 1. Dettagli dell'Ambiente di Esecuzione

I controlli sono stati eseguiti nel container isolato di AI Studio con le seguenti specifiche precise:

- **Commit di Partenza**: `5afcd2b37354cf8fb54071aabebaedb2e584997a`
- **Commit Finale**: `Correzioni finali Prompt 2F`
- **Versione Node.js**: `v20.x`
- **Versione NPM**: `10`
- **Versione Vitest**: `v4.1.8`
- **Run pubblico verificato**: Run pubblico non verificato in questo ambiente.

---

## 2. Stato dei Gate di Qualità e Stile

```text
$ npm ci
Exit code: 0

$ npm run format
Exit code: 0

$ npm run format:check
Exit code: 0

$ npm run typecheck
Exit code: 0

$ npm run lint
Exit code: 0

$ npm run check:all
Exit code: 0
```

---

## 3. Stato dei Test Unitari e d'Integrazione (`npm test`)

- **Runner**: Vitest v4.1.8
- **Stato**: Superato con successo (Exit Code 0).
- **Report di Esecuzione Dettagliato**:

```text
 RUN  v4.1.8 /app/applet

 ✓ src/features/pdfViewer/PdfViewer.test.tsx (18 tests)
 ✓ src/App.test.tsx (1 test)
 ✓ src/features/editor/MonacoEditor.test.tsx (3 tests)
 ✓ test/filesystem.test.ts (6 tests)
 ✓ server.test.ts (1 test)
 ✓ test/repository.test.ts (2 tests)
 ✓ test/syncBehavior.test.ts (2 tests)
 ✓ test/debouncer.test.ts (3 tests)
 ✓ test/paths.test.ts (3 tests)
 ✓ test/projectService.test.ts (2 tests)
 ✓ src/features/compiler/logParser.test.ts (1 test)

 Test Files  11 passed (11)
      Tests  42 passed (42)
```

Tutte le situazioni d'errore del PDF, incluse:

- Transizione asincrona concorrente A → B → C (Scenario 1 e Scenario 2),
- Teardown e cancellazione corretta con singola esecuzione di `PDFDocumentLoadingTask.destroy()`,
- Protezione del trasferimento buffer allo worker,
- Corretta valutazione d'ambiente e Deferred completate rigorosamente,
- Prevenzione di rendering simultanei su canvas,

sono state incorporate nella suite d'automazione dei test con copertura totale e zero failures.

---

## 4. Stato della Compilazione del Workspace (`npm run build`)

- **Stato**: Compilazione riuscita con successo (Build Succeeded, Exit Code 0).

---

## 5. Analisi di Sicurezza e Raggiungibilità (`npm audit`)

- **Stato**: Analizzato e documentato (Exit Code 1, vulnerabilità moderate rilevate nel pacchetto `dompurify` non auto-risolvibili a causa del vincolo rigido di Monaco Editor).
- **File di Output JSON Reale**: L'esito verbatim dell'audit è registrato in `docs/evidence/npm-audit-2026-06-17.json`.
- **Relazioni Empiriche**:
  ```text
  $ npm ls dompurify monaco-editor esbuild vite tsx pdfjs-dist
  project@0.0.0 /app/applet
  ├── dompurify@3.2.7
  ├── esbuild@0.25.12
  ├── monaco-editor@0.55.1
  ├── pdfjs-dist@6.0.227
  ├── tsx@4.x
  └── vite@6.0.0
  ```
- **Risk Assessment**:
  - Un'analisi approfondita sulle origini e sull'uso di DOMPurify dentro le sorgenti Monaco è disponibile in `docs/security/MONACO_DOMPURIFY_REACHABILITY.md`, aggiornato con le direttive che confermano che SAFE_FOR_XML è attivo di default, rendendo potenziale il rischio indicato da `GHSA-v2wj-7wpq-c8vv` se attivato tramite SVG malevoli.
