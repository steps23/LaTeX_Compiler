import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getStorageInfo } from "./storage";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);

describe("storage adapter", () => {
  beforeEach(() => {
    delete window.__TAURI_INTERNALS__;
    invokeMock.mockReset();
  });

  test("uses IndexedDB contract in browser mode without IPC", async () => {
    await expect(getStorageInfo()).resolves.toEqual({
      contractVersion: 1,
      backend: "indexeddb",
      projectRootDir: null,
    });
    expect(invokeMock).not.toHaveBeenCalled();
  });

  test("returns a valid Tauri app-data storage contract", async () => {
    window.__TAURI_INTERNALS__ = {};
    invokeMock.mockResolvedValue({
      contractVersion: 1,
      backend: "tauri-app-data",
      projectRootDir: "/tmp/TeXForge/projects",
    });

    await expect(getStorageInfo()).resolves.toEqual({
      contractVersion: 1,
      backend: "tauri-app-data",
      projectRootDir: "/tmp/TeXForge/projects",
    });
    expect(invokeMock).toHaveBeenCalledOnce();
    expect(invokeMock).toHaveBeenCalledWith("get_storage_info");
  });

  test("rejects an incompatible storage IPC contract", async () => {
    window.__TAURI_INTERNALS__ = {};
    invokeMock.mockResolvedValue({
      contractVersion: 2,
      backend: "tauri-app-data",
    });

    await expect(getStorageInfo()).rejects.toThrow(
      "Unsupported storage information contract",
    );
  });
});
