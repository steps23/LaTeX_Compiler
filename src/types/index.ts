export type ProjectStorageMode = "local" | "drive" | "hybrid";

export type SyncStatus =
  | "local-only"
  | "pending"
  | "syncing"
  | "synced"
  | "conflict"
  | "error"
  | "offline";

export type Project = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  mainFilePath: string;
  settings: ProjectSettings;
  storageMode: ProjectStorageMode;
  syncStatus: SyncStatus;
  syncAccountId?: string;
  driveId?: string;
  driveFolderId?: string;
  isDeleted?: boolean;
};

export type ProjectSettings = {
  compiler: "wasm" | "server" | "http-fallback";
  autoCompile: boolean;
  autoCompileDelayMs: number;
  fontSize: number;
};

export type FileNode = {
  id: string;
  projectId: string;
  path: string; // e.g. "main.tex" or "images/logo.png"
  parentPath?: string;
  name: string;
  isFolder: boolean;
  content?: string; // For text files
  blob?: Blob; // For binary files
  mimeType?: string;
  size?: number;
  hash?: string;
  updatedAt: number;
  isDeleted?: boolean;
  deletedAt?: number;
  syncStatus?: SyncStatus;
  remoteFileId?: string;
  remoteVersion?: string;
  remoteModifiedAt?: number;
  lastSyncedHash?: string;
};

export type SyncAccount = {
  id: string;
  provider: "google-drive";
  email: string;
  displayName: string;
  avatarUrl?: string;
  addedAt: number;
  isActive: boolean;
  // Tokens are omitted here intentionally for security in a client-side store,
  // or stored securely if needed. Wait for OAuth specs.
};

export type SyncBinding = {
  id: string;
  projectId: string;
  accountId: string;
  boundAt: number;
  driveFolderId: string;
};

export type SyncOperationType = "upload" | "download" | "delete" | "mkdir";

export type SyncOperation = {
  id: string;
  projectId: string;
  fileId?: string;
  type: SyncOperationType;
  status: "queued" | "processing" | "failed";
  retryCount: number;
  queuedAt: number;
  error?: string;
};

export type SyncConflict = {
  id: string;
  projectId: string;
  fileId: string;
  localHash: string;
  remoteHash: string;
  resolved: boolean;
  createdAt: number;
};

export type CompileResult = {
  success: boolean;
  pdfBytes?: Uint8Array;
  rawLog: string;
  errors: CompileMessage[];
  warnings: CompileMessage[];
  durationMs: number;
};

export type CompileMessage = {
  severity: "error" | "warning";
  message: string;
  file?: string;
  line?: number;
  context?: string;
};

export type AppSettings = {
  id: string; // "default"
  theme: "light" | "dark" | "system";
};

export interface LatexCompiler {
  initialize(): Promise<void>;
  compile(files: FileNode[], mainPath: string): Promise<CompileResult>;
  cancel(): void;
  dispose(): void;
}
