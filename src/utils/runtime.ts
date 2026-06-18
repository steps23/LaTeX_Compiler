import { invoke } from "@tauri-apps/api/core";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export const isTauri = () => {
  return (
    typeof window !== "undefined" && window.__TAURI_INTERNALS__ !== undefined
  );
};

export interface RuntimeInfo {
  appVersion: string;
  os: string;
  arch: string;
}

export const getRuntimeInfo = async (): Promise<RuntimeInfo | null> => {
  if (!isTauri()) {
    return null;
  }
  try {
    const info = await invoke<RuntimeInfo>("get_runtime_info");
    return info;
  } catch (error) {
    console.error("Failed to get runtime info:", error);
    return null;
  }
};
