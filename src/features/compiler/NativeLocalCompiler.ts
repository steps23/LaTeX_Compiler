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
    const result = await invoke<NativeCompileResult>("compile_latex_project", {
      request: {
        mainPath,
        runtimeId,
        files: nativeFiles,
      },
    });

    return {
      ...result,
      pdfBytes: result.pdfBytes ? new Uint8Array(result.pdfBytes) : undefined,
    };
  }

  cancel(): void {
    // Cancellation will be added with a compile job registry.
  }

  dispose(): void {}
}
