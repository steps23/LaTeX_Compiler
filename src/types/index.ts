export type ProjectStorageMode = "local";

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
  isDeleted?: boolean;
};

export type TexCompileEngine =
  | "auto"
  | "latexmk"
  | "pdflatex"
  | "xelatex"
  | "lualatex";

export type ProjectSettings = {
  compiler: "wasm" | "server" | "http-fallback";
  autoCompile: boolean;
  autoCompileDelayMs: number;
  fontSize: number;
  texRuntimeId?: string | null;
  texCompileEngine?: TexCompileEngine;
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

export type SyncTexArtifact = {
  id: string;
  output: string;
};

export type SyncTexLocation = {
  page: number;
  x: number;
  y: number;
  h?: number;
  v?: number;
  width?: number;
  height?: number;
};

export type SyncTexSourceLocation = {
  inputPath: string;
  line: number;
  column?: number;
  offset?: number;
  context?: string;
};

export type CompileResult = {
  success: boolean;
  pdfBytes?: Uint8Array;
  rawLog: string;
  errors: CompileMessage[];
  warnings: CompileMessage[];
  durationMs: number;
  syncTex?: SyncTexArtifact;
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
  compile(
    files: FileNode[],
    mainPath: string,
    project?: Project | null,
  ): Promise<CompileResult>;
  cancel(): void;
  dispose(): void;
}
