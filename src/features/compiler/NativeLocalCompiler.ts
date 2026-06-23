import { invoke } from "@tauri-apps/api/core";
import type {
  CompileResult,
  FileNode,
  LatexCompiler,
  Project,
} from "../../types";
import {
  getTexRuntimeSelection,
  resolveEffectiveTexRuntimeId,
} from "../../utils/texRuntime";

type NativeCompileFile = Omit<FileNode, "blob"> & {
  binaryBytes?: number[];
};

type NativeCompileResult = Omit<CompileResult, "pdfBytes"> & {
  pdfBytes?: number[];
};

const blobToBytes = async (blob: Blob): Promise<number[]> =>
  Array.from(new Uint8Array(await blob.arrayBuffer()));

const toNativeCompileFile = async (
  file: FileNode,
): Promise<NativeCompileFile> => {
  const { blob, ...rest } = file;
  if (!blob) return rest;
  return { ...rest, binaryBytes: await blobToBytes(blob) };
};

export class NativeLocalCompiler implements LatexCompiler {
  private currentJobId: string | null = null;

  async initialize(): Promise<void> {
    // Native command resolves and invokes the selected local TeX executable.
  }

  async compile(
    files: FileNode[],
    mainPath: string,
    project?: Project | null,
  ): Promise<CompileResult> {
    const globalSelection = await getTexRuntimeSelection();
    const runtimeId = resolveEffectiveTexRuntimeId(project, globalSelection);
    const nativeFiles = await Promise.all(files.map(toNativeCompileFile));
    const jobId = crypto.randomUUID();
    this.currentJobId = jobId;
    try {
      const result = await invoke<NativeCompileResult>(
        "compile_latex_project",
        {
          request: {
            jobId,
            mainPath,
            runtimeId,
            compileEngine: project?.settings.texCompileEngine ?? "auto",
            files: nativeFiles,
          },
        },
      );

      return {
        ...result,
        pdfBytes: result.pdfBytes ? new Uint8Array(result.pdfBytes) : undefined,
      };
    } finally {
      if (this.currentJobId === jobId) {
        this.currentJobId = null;
      }
    }
  }

  cancel(): void {
    if (!this.currentJobId) return;
    void invoke("cancel_latex_compile", { jobId: this.currentJobId });
  }

  dispose(): void {}
}
