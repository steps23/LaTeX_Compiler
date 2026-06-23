import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { NativeLocalCompiler } from "./NativeLocalCompiler";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("../../utils/texRuntime", () => ({
  getTexRuntimeSelection: vi.fn(async () => ({
    contractVersion: 1,
    selectedRuntimeId: "global-runtime",
    selectedBinDir: "/opt/tex/bin",
    updatedAt: 1710000000000,
  })),
  resolveEffectiveTexRuntimeId: vi.fn(() => "project-runtime"),
}));

const invokeMock = vi.mocked(invoke);

describe("NativeLocalCompiler", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  test("sends project files and effective runtime to native compiler", async () => {
    invokeMock.mockResolvedValue({
      success: true,
      pdfBytes: [37, 80, 68, 70],
      rawLog: "ok",
      errors: [],
      warnings: [],
      durationMs: 12,
    });

    const compiler = new NativeLocalCompiler();
    const result = await compiler.compile(
      [
        {
          id: "file-1",
          projectId: "project-1",
          path: "main.tex",
          name: "main.tex",
          isFolder: false,
          content: "\\documentclass{article}",
          updatedAt: 1,
        },
      ],
      "main.tex",
      {
        id: "project-1",
        name: "Project",
        createdAt: 1,
        updatedAt: 1,
        mainFilePath: "main.tex",
        storageMode: "local",
        syncStatus: "local-only",
        settings: {
          compiler: "http-fallback",
          autoCompile: false,
          autoCompileDelayMs: 2000,
          fontSize: 14,
          texRuntimeId: "project-runtime",
          texCompileEngine: "xelatex",
        },
      },
    );

    expect(invokeMock).toHaveBeenCalledWith("compile_latex_project", {
      request: expect.objectContaining({
        mainPath: "main.tex",
        runtimeId: "project-runtime",
        compileEngine: "xelatex",
        files: [expect.objectContaining({ path: "main.tex" })],
      }),
    });
    expect(result.pdfBytes).toBeInstanceOf(Uint8Array);
    expect(Array.from(result.pdfBytes ?? [])).toEqual([37, 80, 68, 70]);
  });
});
