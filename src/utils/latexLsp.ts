import { invoke } from "@tauri-apps/api/core";
import type { FileNode, Project } from "../types";
import { isTauri } from "./runtime";
import {
  getTexRuntimeSelection,
  resolveEffectiveTexRuntimeId,
} from "./texRuntime";

export type LatexLspCompletion = {
  label: string;
  detail?: string;
  documentation?: string;
  insertText?: string;
};

export type LatexLspCompletionRequest = {
  files: FileNode[];
  activePath: string;
  line: number;
  column: number;
  project?: Project | null;
};

type NativeLspFile = Pick<
  FileNode,
  "path" | "isFolder" | "content" | "isDeleted"
>;

const isCompletion = (value: unknown): value is LatexLspCompletion => {
  if (typeof value !== "object" || value === null) return false;
  const completion = value as Record<string, unknown>;
  return (
    typeof completion.label === "string" &&
    (typeof completion.detail === "string" ||
      completion.detail === undefined) &&
    (typeof completion.documentation === "string" ||
      completion.documentation === undefined) &&
    (typeof completion.insertText === "string" ||
      completion.insertText === undefined)
  );
};

export const isLatexLspCompletions = (
  value: unknown,
): value is LatexLspCompletion[] =>
  Array.isArray(value) && value.every(isCompletion);

export async function queryLatexLspCompletions({
  files,
  activePath,
  line,
  column,
  project,
}: LatexLspCompletionRequest): Promise<LatexLspCompletion[]> {
  if (!isTauri()) return [];
  const globalSelection = await getTexRuntimeSelection();
  const runtimeId = resolveEffectiveTexRuntimeId(project, globalSelection);
  if (!runtimeId) return [];

  const nativeFiles: NativeLspFile[] = files.map((file) => ({
    path: file.path,
    isFolder: file.isFolder,
    content: file.content,
    isDeleted: file.isDeleted,
  }));

  const result: unknown = await invoke("query_latex_lsp_completions", {
    request: {
      runtimeId,
      mainPath: project?.mainFilePath ?? activePath,
      activePath,
      line,
      column,
      files: nativeFiles,
    },
  });
  if (!isLatexLspCompletions(result)) {
    throw new Error("Unsupported LaTeX LSP completion contract");
  }
  return result;
}
