# ADR 0001: Architettura Desktop Offline-First macOS

## Status

Accettato

## Contesto

TeXForge è stato originariamente costruito come applicazione web React, offrendo persistenza offline base (tramite IndexedDB) e un proxy HTTP remoto per la compilazione LaTeX. Il target del prodotto è stato ridefinito per il rilascio di un'app desktop nativa su macOS per architettura Apple Silicon, con completa parità delle funzioni base di Overleaf per un uso privato e sicuro (offline/LAN).

## Decisione Architetturale

Abbiamo deciso di adottare il framework **Tauri v2** come base per l'applicazione desktop, mantenendo **React 19 e TypeScript** per l'interfaccia utente.

I pillar architetturali sono i seguenti:

1. **Core di Sistema (RustBackend)**:
   - File System reale per contenere i `.tex` e assets (`fs` scope di Tauri limitato alla workspace scelta dall'utente). Abbandono di IndexedDB per il contenuto raw dei documenti.
   - Database interno asincrono per i **Metadati** (Progetti storici, tag, preferenze, history commit): utilizzo di **SQLite** manovrato da Rust (es. sqlx o rusqlite) in `~/Library/Application Support/...`.
2. **Motore di Compilazione (TeX Live / MacTeX / latexmk)**:
   - Integrazione nativa del binario presente a sistema oppure via container/sidecar isolation su macOS. Abbandono immediato del `HttpFallbackCompiler` in produzione per evitare lock-in ai servizi cloud (`texlive.net`).
3. **Migliorie Editor (LSP & SyncTeX)**:
   - Associazione ad un demone `texlab` controllato via `Sidecar` per LSP (Autocomplete, Definitions).
   - Mapping di `SyncTeX` tramite invocazione bridge Rust per gestire i marker del compilatore ed associare codice a Viewer PDF.
4. **Sicurezza e App Distribution**:
   - Compilazione targetizzata puramente ad `aarch64-apple-darwin` usando le features di macos gatekeeper bypass (Code Signing e Apple Notarization pre-configurati nei tools CI).

## Conseguenze

### Vantaggi:

- **Offline Puro**: La privacy degli utenti e i dati di ricerca o dataset accademici restano sigillati nel computer locale. Nessun invio dati via network.
- **Performance**: Accesso a filesystem nativo (senza limiti memory Blob IndexedDB) significa supporto a progetti molto pesanti (centinaia di immagini HD).
- **Parità Features**: latexmk nativo ha piena compatibilità che il wrapper HTTP CGI limitato non aveva.

### Svantaggi / Rischio:

- Maggiore sforzo logistico per far matchare le dipendenze degli utenti macOS (TeX Live è un installabile enorme; serve una strategia per rilevare MacTeX).
- Transizione di tutti i `Services` dal dialogare asincronicamente al DB (Rx/Promises IDB) a dialogare asincronicamente col backend Rust IPC (Tauri `invoke`).
