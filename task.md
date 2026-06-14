# TeXForge Implementation Tasks

This document contains the complete checklist of development tasks for TeXForge. Tasks are organized by phase and must be completed in order.

---

## Phase 1 — Audit and Stabilization
- [x] Restore or clone the actual Git repository
- [x] Verify remote (`git remote -v`), branch, and active baseline commit
- [x] Create dedicated development branch
- [x] Inspect `.gitignore`, `.env`, `.env.example` and verify no credentials or secrets are committed
- [x] Install Rust toolchain with rustup
- [x] Verify rustc and cargo versions
- [x] Verify macOS Tauri prerequisites
- [x] Verify compatible Tauri CLI
- [x] Capture source-reference baseline in `IMPLEMENTATION_PLAN_V3.md` before implementation decisions are treated as final
- [x] Run baseline frontend commands
- [x] Record all command outputs in `IMPLEMENTATION_STATUS.md`
- [x] Perform codebase documentation audit and verify Monaco npm imports vs PDF.js CDN worker in [AUDIT.md](AUDIT.md)
- [x] Clarify `src/state/db.ts` legacy IndexedDB export adapter role (TypeScript browser export only)
- [x] Configure strict TypeScript parameters in `tsconfig.json` and fix compiling errors
- [x] Separate `npm run lint` into `npm run typecheck` and `npm run lint` scripts
- [x] Install `react-router-dom` and `jszip`
- [x] Initialize Tauri 2 project structure (`src-tauri/` directory)
- [x] Configure minimal Tauri capabilities in `src-tauri/capabilities/default.json` and reference them explicitly from `tauri.conf.json`
- [x] Verify React has no general filesystem or shell plugin surface; all project file operations and compiler launches are Rust-owned
- [x] Remove active Express server dependency from default packaged execution paths
- [x] Fix all Mermaid diagrams syntax and verify that every block renders successfully
- [x] Verify no Markdown headings are contained inside SQL code fences
- [x] Perform final documentation consistency check

---

## Phase 2 — Native SQLite and Filesystem Data Layer
- [ ] Implement SQLite service background thread with one writer-owned connection in Rust (`db.rs`)
- [ ] Configure typed bounded mpsc channel for database thread queries and remove connection pool references
- [ ] Implement database request/response channels (typed DB request enum, bounded request queue, oneshot response channels, and explicit error types)
- [ ] Implement database graceful shutdown request and acknowledgement flows without abandoning thread while WAL changes are pending
- [ ] Configure WAL mode, foreign keys, and busy timeout parameters
- [ ] Implement SQLite migrations manager with numbered, idempotent migrations tracked via `schema_migrations` table
- [ ] Use SQLite backup/checkpoint APIs for safe transactional migrations instead of copying active database, WAL, or SHM files blindly
- [ ] Create Phase 2 local base schema with dormant synchronization columns (`base_hash`, `remote_md5_checksum`, `remote_version`, `remote_modified_time`, `last_synced_at`, `sync_dirty`, `tombstone`, `last_sync_error`, `drive_file_id`, `drive_parent_folder_id`)
- [ ] Enforce strict Phase 2 local-only database CHECK constraints (storage_mode = 'local', sync_status = 'local-only', sync_dirty = 0, tombstone = 0)
- [ ] Enforce Phase 2 dormant-null database CHECK constraints (drive account, folders, manifest, checksums, and Drive file IDs must be null)
- [ ] Implement project creation and directory initialization under the user-selected parent directory (initially proposing Documents as default, resolved via native chooser and opaque selection token)
- [ ] Resolve platform-native application data, cache, and recovery directories via Tauri Path APIs (`<app-data-dir>/recovery/` etc.) using secure permissions
- [ ] Implement folder registration (adding an existing folder path to SQLite)
- [ ] Implement trusted native folder dialog selection flow using opaque single-use selection tokens (session-bound, expiring, consumed immediately)
- [ ] Implement path authorization algorithms (resolve, canonicalize, check `..`, check symlinks)
- [ ] Implement filesystem CRUD commands in Rust with path verification using tokens
- [ ] Enforce registered project-root authorization in every filesystem command
- [ ] Enforce same-project directory parent relationship validation via compound foreign key in SQLite
- [ ] Create Phase 2 SQLite `project_settings` table (normalized layout referencing projects, nullable main_file_uuid, allowlisted compiler_engine, bounded compile_timeout_seconds)
- [ ] Implement `main_file_uuid` as a single-column `files(uuid) ON DELETE SET NULL` reference, with triggers/Rust validation for same-project and `kind = 'file'`
- [ ] Implement SQLite INSERT and UPDATE triggers on `files` to prevent self-parenting (`parent_uuid != uuid`)
- [ ] Implement SQLite triggers to validate that `main_file_uuid` in `project_settings` refers to a row with `kind = 'file'`
- [ ] Implement SQLite triggers or recursive CTE validation in Rust/SQLite to prevent directory cycles
- [ ] Implement SQLite triggers or Rust validation to verify that `parent_uuid` in `files` refers to a row with `kind = 'folder'`
- [ ] Implement equivalent Rust validation in the command handler before database mutations
- [ ] Write integration tests for hierarchy integrity (testing cross-project parents, file-as-parent, self-parenting, indirect cycles, invalid main-document folders, and deleted-main-document nulling)
- [ ] Define compensating cleanup for directories/files when database registration fails during project creation, import, or registration (never deleting pre-existing user-owned external folders)
- [ ] Keep Monaco unsaved dirty states in memory and separate them from disk-saved `sync_dirty` states
- [ ] Distinguish local missing-file records from Drive tombstones (tombstone used/named specifically for remote sync delete)
- [ ] Define shared internal exclusion policy (exclude build/cache/recovery/temp files using logical paths)
- [ ] Exclude compiler build outputs from normal project source file trees and watchers (output path under `<app-data-dir>/build/` or cleanable via UI action)
- [ ] Configure detected MIME types in files database and directories as `inode/directory`
- [ ] Implement database request draining before destructive migrations
- [ ] Implement SQLite Backup API pre-migration backup
- [ ] Add migration row-count validation
- [ ] Add post-migration `PRAGMA foreign_key_check`
- [ ] Add migration restore-on-failure tests
- [ ] Implement new-project creation flow
- [ ] Implement existing-registered-project open and reconciliation flow
- [ ] Implement external-folder registration flow
- [ ] Detect candidate main documents in external folders
- [ ] Prompt for the main document when detection is ambiguous

---

## Phase 3 — Editor Durability and File Watcher
- [ ] Implement editor dirty-state model and unsaved buffer tracking
- [ ] Configure Monaco local save pipeline (Zustand dirty -> debounce -> Rust write command)
- [ ] Implement local-only save behavior in Phase 3 (sync_dirty remains 0, no Drive sync queue item is enqueued)
- [ ] Return a typed result for file save distinguishing: failed-before-durable-write, saved-and-indexed, and saved-needs-reconciliation
- [ ] Schedule reconciliation and show a metadata warning badge if the disk save succeeded but SQLite indexing failed, keeping recovery snapshot until disk confirmation
- [ ] Implement atomic write replacements in Rust (temp file -> atomic rename)
- [ ] Place recovery snapshot files under `<app-data-dir>/recovery/` outside watched roots with restrictive permissions
- [ ] Preserve recovery snapshot until restored content is durably saved (restore -> load buffer -> write confirm -> delete snapshot)
- [ ] Implement snapshot compare and explicit discard workflows with confirmation checks
- [ ] Add recovery snapshot retention policy and automatic background cleanup of abandoned items
- [ ] Run directory reconciliation loops (`reconcile_project`) before starting the file watcher on open
- [ ] Implement watcher startup failure degraded mode handling (warning in UI, keep project open in degraded mode, and allow manual reconciliation)
- [ ] Handle watcher overflow followed by reconciliation
- [ ] Implement close-intercept bounded shutdown state machine flow (running, close-requested, saving, recovery-confirmed, stopping-services, safe-to-exit, forced-exit-with-recovery)
- [ ] Implement `notify`-based directory watcher inside Rust backend
- [ ] Add watcher start/stop lifecycles associated with opening/closing projects
- [ ] Implement watcher loop prevention (compare hashes and timestamp registries)
- [ ] Build external modification conflict prompt UI when editor buffer is dirty

---

## Phase 4 — Local Compilation and PDF Viewer
- [ ] Implement local LaTeX compiler auto-detection paths in Rust (PATH, TeX Live/MiKTeX default locations, macOS Library/TeX/texbin, Windows Registry, user selected)
- [ ] Implement non-blocking Rust compiler process spawning via `tokio::process::Command` (reject arbitrary paths from React, arguments assembled and validated in Rust)
- [ ] Enforce no arbitrary frontend shell execution limits (direct spawner process verification in Rust)
- [ ] Completely disable shell escape throughout Phases 1–7 (never pass shell escape flag, pass engine no-shell option, allowlist arguments, no UI opt-in)
- [ ] Implement unique `compilation_id` creation and stable ID event tracking flow immediately upon receiving request (running or pending state)
- [ ] Ensure compilation ID is preserved during promotion from pending to running
- [ ] Stream compiler stdout/stderr lines through typed Tauri events carrying the `compilation_id` and monotonic sequence numbers
- [ ] Enforce at most one active compilation per project with a single-item queue (replacing/coalescing pending compiles)
- [ ] Emit superseded compilation event when a pending request is replaced
- [ ] Ensure every compilation lifecycle has exactly one terminal event (succeeded, failed, timed-out, cancelled, or superseded)
- [ ] Discard late events after a terminal event has been emitted
- [ ] Implement process-tree cancellation matching a specific `compilation_id` (process groups on macOS/Linux, Job Objects on Windows)
- [ ] Configure compilation timeout parameters (e.g. 30 seconds) and verify complete process-tree termination
- [ ] Retain and mark the last successful PDF as stale when builds fail
- [ ] Bundle PDF.js worker locally inside frontend asset paths (zero CDN dependency)
- [ ] Verify bundled PDF.js worker version matches `pdfjs-dist` and fail tests/build on CDN worker URLs
- [ ] Complete PDF viewer toolbar actions (virtualization, page navigation, zoom, fit, rotate, print, copy/save, open externally)
- [ ] Integrate SyncTeX source-to-pdf and pdf-to-source mapping only when SyncTeX is available (disabled by default)
- [ ] Implement explicit external `texlive.net` fallback privacy warning policy (disabled by default, manual opt-in, clear transmission warning, blocked globally if disabled, transmission file enumeration in warning)
- [ ] Pass `-file-line-error` for compatible TeX engines
- [ ] Add equivalent file-line mode for supported non-standard engines
- [ ] Test errors from included `.tex` files
- [ ] Test errors from `.sty` and `.cls` files
- [ ] Test paths containing spaces
- [ ] Test Unicode source paths
- [ ] Test malformed and truncated compiler logs
- [ ] Verify clickable errors open the correct file and line

---

## Phase 5 — Tectonic Setup
- [ ] Pin Tectonic CLI version, download URLs, and target binary SHA-256 hashes
- [ ] Define Tectonic sidecar target-triple packaging and exact allowed argument list if Tauri sidecar permissions are used
- [ ] Implement temporary download and SHA-256 validation of the sidecar executables
- [ ] Implement verified package resource bundle download and atomic extraction
- [ ] Configure Tectonic command execution with local bundle paths and `--only-cached` flags
- [ ] Build compiler setup and download status UI panels
- [ ] Implement repair, verification, and removal actions for Tectonic sidecars
- [ ] Verify Tectonic executable and verified local bundle setup completed before offline compiles

---

## Phase 6 — Legacy Migration and Import
- [ ] Implement manual ZIP export in legacy browser prototype producing `<project-name>.texforge.zip`
- [ ] Verify manifest `.texforge.json` is packaged inside the ZIP (not standalone export)
- [ ] Implement ZIP import file selectors in desktop dashboard using selection tokens
- [ ] Implement Rust-based ZIP archive importer (`importer.rs`)
  * Enforce maximum compressed (50MB) and uncompressed (200MB) size boundaries
  * Reject traversal components (`..`) and symbolic links in archives
  * Atomic move of the verified directory and write registry updates
- [ ] Test archive binary-asset handling (images, fonts, user PDFs) and verify generated output compiler files are excluded
- [ ] Test archive empty directories, Unicode filenames, duplicate paths, oversized archives, checksum mismatch, traversal, corrupted ZIPs, and unsupported schema versions
- [ ] Register imported project paths in SQLite and finalize migrations

---

## Phase 7 — Local Desktop Acceptance Gate (BLOCKING GATE)
- [ ] Verify packaged startup launches cleanly on target platform
- [ ] Create a packaged smoke test using a built artifact (e.g. dmg, app, exe, or msi) and verify no Express service is required (and without assuming port 3000 is globally free)
- [ ] Verify application operates completely offline without Express or networking
- [ ] Verify project dashboard works cleanly with local-milestone project registry functions (remove registration vs permanent delete files distinction)
- [ ] Configure React `HashRouter` routing for Tauri compatible view rendering (dashboard, workspace, settings, recovery, conflicts)
- [ ] Verify new project creation flow reconciles and watches correctly
- [ ] Verify existing registered project open flow reconciles and watches correctly
- [ ] Verify newly registered external folder flow (trust directory, symlink check, full initial reconciliation, main document selection/detection)
- [ ] Verify nested file CRUD operations execute correctly on disk
- [ ] Verify Monaco editor autosaves changes and marks buffers clean
- [ ] Verify Ctrl/Cmd+S forces immediate saves
- [ ] Verify save error display alerts the user
- [ ] Verify crash recovery restores recovery content after abnormal shutdown
- [ ] Verify watcher notices external changes and prompts conflicts on dirty buffers
- [ ] Verify watchers stop cleanly when switching or closing projects
- [ ] Verify `reconcile_project` correctly captures changes made while closed
- [ ] Verify local compilation succeeds using pdflatex or latexmk (detecting compilers properly)
- [ ] Verify image, bibliography, and style/class file attachments
- [ ] Verify compiler log streaming in real time with compilation ID
- [ ] Verify correct error navigation clicks to Monaco file and line
- [ ] Verify compilation timeout works and cleans up process trees
- [ ] Verify compiler process cancellation cleans up child tasks
- [ ] Verify cancelling of an older run after a newer compiler run has started
- [ ] Verify ignoring of delayed/stale compiler events from finished runs
- [ ] Verify prevention of duplicate terminal events
- [ ] Verify shell escape is completely disabled
- [ ] Verify last valid PDF remains available after failure
- [ ] Verify stale-PDF warning is visible
- [ ] Verify PDF.js renders local compile output with Zoom and print controls
- [ ] Verify PDF navigation and download actions work
- [ ] Verify all automated Rust tests pass
- [ ] Verify all automated React frontend tests pass
- [ ] Verify typescript strict checks pass
- [ ] Verify clippy checks pass with warnings treated as errors
- [ ] Verify production frontend build passes
- [ ] Verify packaged desktop smoke test passes

---

## Phase 8 — Google Desktop OAuth (Blocked by Phase 7)
*Phase 8 is blocked and cannot be started until Phase 7 Gate is verified and passes.*
- [ ] Register Google Cloud OAuth Desktop Application Client credentials
- [ ] Implement Authorization Code Flow with PKCE (S256 verifier)
- [ ] Launch authorization in the system browser, never inside the Tauri WebView
- [ ] Bind temporary local loopback redirect server to `127.0.0.1` or `[::1]` on an ephemeral port, never `0.0.0.0`
- [ ] Replace OAuth "capture token" loopback server wording with browser authorization-code exchange
- [ ] Implement random state validation checks
- [ ] Store refresh tokens securely using the OS Keychain service (`keyring` crate)
- [ ] Create Phase 8 `drive_accounts` schema tables and non-secret account metadata
- [ ] Implement transactional project table migration to enforce foreign key referencing `drive_accounts`
- [ ] Implement login, logout, account switching, and token revocation commands
- [ ] Implement SQLite generalized `projects_new` table rebuild sequence:
  - [ ] Pause/drain connection requests before beginning rebuild
  - [ ] Verify database file backup via SQLite Backup API first
  - [ ] Execute `PRAGMA foreign_keys = OFF;` on the connection before transaction `BEGIN`
  - [ ] Copy all rows to `projects_new` and verify row counts and required non-null constraints
  - [ ] Drop `projects`, rename `projects_new` to `projects`, and recreate affected indexes and triggers
  - [ ] Commit transaction, then execute `PRAGMA foreign_keys = ON;`
  - [ ] Run `PRAGMA foreign_key_check;` to verify integrity
  - [ ] Roll back transaction and invoke database restore on failure before resuming requests
- [ ] Preserve dependent `files.project_uuid` foreign keys
- [ ] Restrict Phase 8 population to `drive_account_id` (keeping Drive folder, manifest, and sync fields null)

---

## Phase 9 — Google Drive Synchronization (Blocked by successful completion of Phases 7 and 8)
*Phase 9 is blocked and cannot be started until Phases 7 and 8 are completed.*
- [ ] Request narrow scope `https://www.googleapis.com/auth/drive.file`
- [ ] Document that `drive.file` limits discovery to app-created or user-opened/shared files; do not promise arbitrary whole-Drive browsing
- [ ] Create remote projects mirror directories under `My Drive/TeXForge/`
- [ ] Write remote `.texforge.json` manifests and set UUID custom `appProperties`
- [ ] Create Phase 9 target tables `projects_new` and `files_new` with complete DDL schemas (storage_mode, sync_status, tombstone, activated remote columns, unique indexes, and foreign keys)
- [ ] Create Phase 9 SQLite `sync_queue` and `conflicts` retention-safe tables; use single-column nullable `conflicts.file_uuid ON DELETE SET NULL` plus triggers/Rust validation to retain `project_uuid`
- [ ] Enforce remote identity account binding (`drive_file_id` or `drive_parent_folder_id` requires non-null `drive_account_id`)
- [ ] Enforce sync_queue status lease-field invariants (CHECK constraint in DDL)
- [ ] Implement atomic queue claim and lease heartbeat renewal
- [ ] Implement expired lease reclamation
- [ ] Add exponential retry backoff with jitter
- [ ] Test concurrent queue-claim attempts, owner-mismatched renewal, and lease release
- [ ] Delete successful queue operations transactionally from `sync_queue` and record a redacted, rotated history log
- [ ] Retrieve refresh tokens from the OS keychain and refresh access tokens natively in Rust
- [ ] Scope `drive_file_id` uniqueness by project or account context (via compound unique index `idx_files_unique_remote_binding` on `(drive_account_id, drive_file_id)`)
- [ ] Test shared Drive files across multiple accounts
- [ ] Store Drive account context for update and delete operations
- [ ] Create conflict snapshot directories using `conflict_id` under `<app-data-dir>/conflicts/<project_uuid>/<conflict_id>/` to prevent overwrite
- [ ] Enforce retention-safe conflicts design (nullable `file_uuid` with ON DELETE SET NULL, historical NOT NULL identity, unique open conflict index)
- [ ] Test conflict-specific cleanup and history retention (retaining active/pending/error conflicts and cleaning resolved rows after 30 days)
- [ ] Activate the synchronized save branch: update files metadata to sync_dirty = 1, sync_status = 'queued', and enqueue a Drive synchronization task on editor save
- [ ] Implement change scrolling using Drive change tokens, scrolling through all changes pages before committing start-page tokens
- [ ] Implement bidirectional conflict detection using hashes (base/local/remote)
- [ ] Connect Monaco Diff editor UI to resolve concurrent updates manually
- [ ] Implement future Drive-only project discovery summary listings

---

## Phase 10 — Distribution and CI
- [ ] Configure CI pipelines with OS build matrix (macOS, Windows, Linux)
- [ ] Build Windows installer packages (MSI / NSIS)
- [ ] Build macOS DMG and app bundle artifacts (Intel and Apple Silicon)
- [ ] Build Linux deb and AppImage packages
- [ ] Document code-signing and notarization requirements
- [ ] Assemble licenses, SBOMs, and third-party notices
