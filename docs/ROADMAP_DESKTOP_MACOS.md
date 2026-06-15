# Roadmap: macOS Apple Silicon Desktop App

Obiettivo: Porting di TeXForge da Web SPA (IndexedDB + HTTP Compiler) ad App Desktop Apple Silicon nativa (Tauri v2 + SQLite + Local TeX Live).

## Fase 1: Stabilizzazione Baseline & Setup Tauri

- Correggere gli errori TypeScript attuali (`S256` assignment e Monaco `ICodeEditorViewState`).
- Correggere gli warning e l'errore ESLint (`react-hooks/set-state-in-effect`), ripulendo i file `src/`.
- Inizializzare Tauri v2 (`aarch64-apple-darwin`).
- Configurare il bridge IPC tra il frontend React e il backend Rust.

## Fase 2: Core Filesystem backend e Migrazione Dati

- Sostituire IndexedDB con SQLite (lato Rust) per gestire meta-informazioni progetto, settings e sync state locale.
- Gestire il salvataggio dei file dei progetti direttamente sul file system nativo macOS (es. `~/Documents/TeXForge/`).
- Aggiornare le interfacce `ProjectService` e `FileService` per dialogare via IPC con i comandi Tauri invece di IndexedDB.

## Fase 3: Local LaTeX Toolchain (Il Motore offline)

- Predisporre il check di dipendenze (es. MacTeX / TeX Live 2026 preinstallati nel sistema, o scaricare i sidecar essenziali).
- Sostituire l'`HttpFallbackCompiler` con un un `RustLocalCompiler` che orchestra invocazioni a `latexmk` tramite Tauri Command (`std::process::Command`).
- Mappare i file log `.log` tramite parsers Rust per restituire formati d'errore leggibili a Monaco Editor.

## Fase 4: LSP e SyncTeX

- Integrare `texlab` come Language Server Protocol via standard I/O (inviando e ricevendo messaggi JSON-RPC tra Monaco e un sidecar Rust).
- Implementare il supporto al SyncTeX: parsing in Rust dei file `.synctex` compilati e mapping IPC (coordinare il click su PDF.js e la linea di Monaco Editor e viceversa).

## Fase 5: Collaborazione LAN In-App

- Rimuovere le specifiche di Google Drive integration dal core.
- Integrare Yjs e WebRTC/WebSocket in Rust per consentire sessioni di co-authoring interamente locali su rete LAN (ZeroTier / Bonjour-based discovery).

## Fase 6: Sicurezza, Permessi & Packaging

- Configurare sandbox e `fs` scope nel `tauri.conf.json` limitando l'accesso del frontend alle sole cartelle documentali richieste (Sicurezza Desktop).
- Gestire Notariato Apple (Notarization) e Code Signing (`security` framework) per la distribuzione `.dmg`/`.app`.
