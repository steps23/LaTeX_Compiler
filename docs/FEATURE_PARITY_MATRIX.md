# Feature Parity Matrix

Confronto tra le funzionalità di Overleaf e lo stato attuale/futuro dell'applicazione desktop macOS.

| Categoria           | Funzionalità                               | Stato Attuale                       | Riproducibilità Desktop Target                                   |
| :------------------ | :----------------------------------------- | :---------------------------------- | :--------------------------------------------------------------- |
| **Editor**          | Syntax Highlighting (LaTeX)                | Già funzionante                     | Riproducibile interamente in locale                              |
| **Editor**          | Autocomplete & Snippets                    | Parzialmente funzionante            | Riproducibile interamente in locale (via texlab LSP)             |
| **Editor**          | Linting Code & Error Parsing               | Parzialmente funzionante            | Riproducibile interamente in locale                              |
| **Editor**          | Code Folding                               | Già funzionante                     | Riproducibile interamente in locale                              |
| **Compilazione**    | Motore LaTeX Base                          | Dipendente da cloud (HTTP Fallback) | Riproducibile interamente in locale (MacTeX/TeX Live)            |
| **Compilazione**    | Motori Vari (pdfLaTeX, XeLaTeX, LuaLaTeX)  | Assente/Fisso                       | Riproducibile interamente in locale (latexmk)                    |
| **Compilazione**    | Autocompile                                | Parzialmente funzionante            | Riproducibile interamente in locale                              |
| **Compilazione**    | SyncTeX (codice -> PDF e PDF -> codice)    | Assente                             | Riproducibile interamente in locale (Synctex)                    |
| **Documentazione**  | File Tree & Struttura Cartelle             | Già funzionante                     | Riproducibile interamente in locale                              |
| **Documentazione**  | Upload Immagini e File esterni             | Parzialmente funzionante            | Riproducibile interamente in locale                              |
| **Collaborazione**  | Real-time Co-editing                       | Solo predisposto / Assente          | Funzione riproducibile solo tramite collaborazione LAN (Yjs)     |
| **Collaborazione**  | Commenti inline & Track Changes            | Assente                             | Riproducibile interamente in locale / LAN                        |
| **Collaborazione**  | Condivisione Progetto via Link             | Assente                             | Funzione dipendente da servizi cloud (integrazione opzionale)    |
| **Version Control** | File History / Time Machine                | Solo predisposto (IndexedDB queue)  | Riproducibile interamente in locale (SQLite / Git-based backend) |
| **Version Control** | Integrazione GitHub/GitLab                 | Assente                             | Funzione dipendente da servizi cloud (integrazione opzionale)    |
| **Progetti**        | Salvataggio Locale (Offline)               | Già funzionante (IndexedDB)         | Riproducibile interamente in locale (File system reale + SQLite) |
| **SaaS/Ecosistema** | Overleaf Premium (Submit to journal, etc.) | Assente                             | Funzione SaaS di Overleaf non replicabile esattamente            |
