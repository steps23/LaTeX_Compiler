import { invoke } from "@tauri-apps/api/core";
import type { SyncTexLocation, SyncTexSourceLocation } from "../types";
import { isTauri } from "./runtime";

export type SyncTexForwardRequest = {
  artifactId: string;
  inputPath: string;
  line: number;
  column?: number;
};

export type SyncTexReverseRequest = {
  artifactId: string;
  page: number;
  x: number;
  y: number;
};

export async function querySyncTexForward(
  request: SyncTexForwardRequest,
): Promise<SyncTexLocation | null> {
  if (!isTauri()) return null;
  return invoke<SyncTexLocation | null>("query_synctex_forward", {
    request: {
      artifactId: request.artifactId,
      inputPath: request.inputPath,
      line: request.line,
      column: request.column ?? 1,
    },
  });
}

export async function querySyncTexReverse(
  request: SyncTexReverseRequest,
): Promise<SyncTexSourceLocation | null> {
  if (!isTauri()) return null;
  return invoke<SyncTexSourceLocation | null>("query_synctex_reverse", {
    request: {
      artifactId: request.artifactId,
      page: request.page,
      x: request.x,
      y: request.y,
    },
  });
}
