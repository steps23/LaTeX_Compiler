import { invoke } from "@tauri-apps/api/core";
import type { SyncTexLocation } from "../types";
import { isTauri } from "./runtime";

export type SyncTexForwardRequest = {
  artifactId: string;
  inputPath: string;
  line: number;
  column?: number;
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
