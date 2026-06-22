import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "./runtime";

export const STORAGE_CONTRACT_VERSION = 1 as const;

export type StorageInfo = {
  contractVersion: typeof STORAGE_CONTRACT_VERSION;
  backend: "indexeddb" | "tauri-app-data";
  projectRootDir: string | null;
};

const browserStorageInfo: StorageInfo = {
  contractVersion: STORAGE_CONTRACT_VERSION,
  backend: "indexeddb",
  projectRootDir: null,
};

const isStorageInfo = (value: unknown): value is StorageInfo => {
  if (typeof value !== "object" || value === null) return false;

  const info = value as Record<string, unknown>;
  return (
    info.contractVersion === STORAGE_CONTRACT_VERSION &&
    info.backend === "tauri-app-data" &&
    typeof info.projectRootDir === "string" &&
    info.projectRootDir.length > 0
  );
};

export const getStorageInfo = async (): Promise<StorageInfo> => {
  if (!isTauri()) return browserStorageInfo;

  const info: unknown = await invoke("get_storage_info");
  if (!isStorageInfo(info)) {
    throw new Error("Unsupported storage information contract");
  }
  return info;
};
