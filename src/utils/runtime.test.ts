import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getRuntimeInfo, isTauri } from "./runtime";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);

describe("runtime adapter", () => {
  beforeEach(() => {
    delete window.__TAURI_INTERNALS__;
    invokeMock.mockReset();
  });

  test("returns the versioned browser contract without IPC", async () => {
    expect(isTauri()).toBe(false);
    await expect(getRuntimeInfo()).resolves.toEqual({
      contractVersion: 1,
      runtime: "browser",
      appVersion: null,
      os: "unknown",
      arch: "unknown",
      targetFamily: "web",
    });
    expect(invokeMock).not.toHaveBeenCalled();
  });

  test("returns a valid versioned Tauri IPC payload", async () => {
    window.__TAURI_INTERNALS__ = {};
    invokeMock.mockResolvedValue({
      contractVersion: 1,
      runtime: "tauri",
      appVersion: "0.1.0",
      os: "macos",
      arch: "aarch64",
      targetFamily: "unix",
    });

    await expect(getRuntimeInfo()).resolves.toEqual({
      contractVersion: 1,
      runtime: "tauri",
      appVersion: "0.1.0",
      os: "macos",
      arch: "aarch64",
      targetFamily: "unix",
    });
    expect(invokeMock).toHaveBeenCalledOnce();
    expect(invokeMock).toHaveBeenCalledWith("get_runtime_info");
  });

  test("rejects an incompatible IPC contract", async () => {
    window.__TAURI_INTERNALS__ = {};
    invokeMock.mockResolvedValue({
      contractVersion: 2,
      runtime: "tauri",
    });

    await expect(getRuntimeInfo()).rejects.toThrow(
      "Unsupported runtime information contract",
    );
  });
});
