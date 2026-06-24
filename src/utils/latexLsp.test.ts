import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { isLatexLspCompletions, queryLatexLspCompletions } from "./latexLsp";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("./runtime", () => ({
  isTauri: vi.fn(() => true),
}));

vi.mock("./texRuntime", () => ({
  getTexRuntimeSelection: vi.fn(async () => ({
    contractVersion: 1,
    selectedRuntimeId: "runtime-1",
    selectedBinDir: "/opt/tex/bin",
    updatedAt: 1710000000000,
  })),
  resolveEffectiveTexRuntimeId: vi.fn(() => "runtime-1"),
}));

const invokeMock = vi.mocked(invoke);

describe("LaTeX LSP adapter", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  test("validates completion payloads", () => {
    expect(
      isLatexLspCompletions([
        { label: "\\section", detail: "section", insertText: "\\section{}" },
      ]),
    ).toBe(true);
    expect(isLatexLspCompletions([{ label: 1 }])).toBe(false);
  });

  test("sends bounded project snapshot and cursor to native LSP command", async () => {
    invokeMock.mockResolvedValue([{ label: "\\begin" }]);

    const result = await queryLatexLspCompletions({
      files: [
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
      activePath: "main.tex",
      line: 1,
      column: 2,
      project: null,
    });

    expect(invokeMock).toHaveBeenCalledWith("query_latex_lsp_completions", {
      request: {
        runtimeId: "runtime-1",
        mainPath: "main.tex",
        activePath: "main.tex",
        line: 1,
        column: 2,
        files: [
          {
            path: "main.tex",
            isFolder: false,
            content: "\\documentclass{article}",
            isDeleted: undefined,
          },
        ],
      },
    });
    expect(result).toEqual([{ label: "\\begin" }]);
  });
});
