import { invoke } from "@tauri-apps/api/core";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export const RUNTIME_CONTRACT_VERSION = 1 as const;

export type RuntimeInfo = {
  contractVersion: typeof RUNTIME_CONTRACT_VERSION;
  runtime: "browser" | "tauri";
  appVersion: string | null;
  os: "macos" | "windows" | "linux" | "unknown";
  arch: string;
  targetFamily: "unix" | "windows" | "web" | "unknown";
};

const browserRuntimeInfo: RuntimeInfo = {
  contractVersion: RUNTIME_CONTRACT_VERSION,
  runtime: "browser",
  appVersion: null,
  os: "unknown",
  arch: "unknown",
  targetFamily: "web",
};

export const isTauri = (): boolean =>
  typeof window !== "undefined" && window.__TAURI_INTERNALS__ !== undefined;

const isRuntimeInfo = (value: unknown): value is RuntimeInfo => {
  if (typeof value !== "object" || value === null) return false;

  const info = value as Record<string, unknown>;
  return (
    info.contractVersion === RUNTIME_CONTRACT_VERSION &&
    info.runtime === "tauri" &&
    typeof info.appVersion === "string" &&
    ["macos", "windows", "linux", "unknown"].includes(String(info.os)) &&
    typeof info.arch === "string" &&
    info.arch.length > 0 &&
    ["unix", "windows", "unknown"].includes(String(info.targetFamily))
  );
};

export const getRuntimeInfo = async (): Promise<RuntimeInfo> => {
  if (!isTauri()) return browserRuntimeInfo;

  const info: unknown = await invoke("get_runtime_info");
  if (!isRuntimeInfo(info)) {
    throw new Error("Unsupported runtime information contract");
  }
  return info;
};
