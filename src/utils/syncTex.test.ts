import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { querySyncTexForward, querySyncTexReverse } from "./syncTex";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("./runtime", () => ({
  isTauri: vi.fn(() => true),
}));

const invokeMock = vi.mocked(invoke);

describe("SyncTeX adapters", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  test("uses bounded native SyncTeX forward command contract", async () => {
    invokeMock.mockResolvedValue({ page: 1, x: 10, y: 20 });

    const result = await querySyncTexForward({
      artifactId: "00000000-0000-4000-8000-000000000001",
      inputPath: "main.tex",
      line: 3,
    });

    expect(invokeMock).toHaveBeenCalledWith("query_synctex_forward", {
      request: {
        artifactId: "00000000-0000-4000-8000-000000000001",
        inputPath: "main.tex",
        line: 3,
        column: 1,
      },
    });
    expect(result).toEqual({ page: 1, x: 10, y: 20 });
  });

  test("uses bounded native SyncTeX reverse command contract", async () => {
    invokeMock.mockResolvedValue({ inputPath: "main.tex", line: 7, column: 1 });

    const result = await querySyncTexReverse({
      artifactId: "00000000-0000-4000-8000-000000000001",
      page: 2,
      x: 72.5,
      y: 144.25,
    });

    expect(invokeMock).toHaveBeenCalledWith("query_synctex_reverse", {
      request: {
        artifactId: "00000000-0000-4000-8000-000000000001",
        page: 2,
        x: 72.5,
        y: 144.25,
      },
    });
    expect(result).toEqual({ inputPath: "main.tex", line: 7, column: 1 });
  });
});
