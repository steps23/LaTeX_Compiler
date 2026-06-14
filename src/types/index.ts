export type Project = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  mainFilePath: string;
  settings: ProjectSettings;
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
  name: string;
  isFolder: boolean;
  content?: string; // For text files
  blob?: Blob;      // For binary files
  updatedAt: number;
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

export interface LatexCompiler {
  initialize(): Promise<void>;
  compile(files: FileNode[], mainPath: string): Promise<CompileResult>;
  cancel(): void;
  dispose(): void;
}
