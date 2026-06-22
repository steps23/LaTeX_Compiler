import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { detectTexRuntimes, isTexRuntimeDiagnostic } from "./texRuntime";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);

describe("TeX runtime adapter", () => {
  beforeEach(() => {
    delete window.__TAURI_INTERNALS__;
    invokeMock.mockReset();
  });

  test("returns browser diagnostic without IPC", async () => {
    await expect(detectTexRuntimes()).resolves.toEqual({
      contractVersion: 1,
      hostOs: "web",
      hostArch: "unknown",
      runtimes: [],
      missingCoreTools: ["latexmk", "pdflatex", "xelatex", "lualatex"],
      notes: [
        "Native LaTeX runtime detection is available only in the Tauri desktop runtime.",
      ],
    });
    expect(invokeMock).not.toHaveBeenCalled();
  });

  test("accepts versioned Tauri diagnostic", async () => {
    window.__TAURI_INTERNALS__ = {};
    const diagnostic = {
      contractVersion: 1,
      hostOs: "macos",
      hostArch: "aarch64",
      runtimes: [
        {
          id: "texlive-fixture",
          distribution: "tex-live",
          version: "pdfTeX fixture",
          arch: "aarch64",
          rootDir: "/Library/TeX",
          binDir: "/Library/TeX/texbin",
          tools: [
            {
              name: "pdflatex",
              path: "/Library/TeX/texbin/pdflatex",
              version: "pdfTeX fixture",
              status: "available",
              diagnostic: null,
            },
          ],
          packageManager: "tlmgr",
          status: "available",
          detectionSource: "fixture",
          compatibleWithHost: true,
          capabilities: {
            canCompilePdf: true,
            hasBibliography: false,
            hasPackageManager: true,
            hasSynctex: false,
          },
        },
      ],
      missingCoreTools: ["latexmk"],
      notes: ["fixture"],
    };
    invokeMock.mockResolvedValue(diagnostic);

    await expect(detectTexRuntimes()).resolves.toEqual(diagnostic);
    expect(invokeMock).toHaveBeenCalledWith("detect_tex_runtimes");
  });

  test("rejects incompatible diagnostic contract", async () => {
    window.__TAURI_INTERNALS__ = {};
    invokeMock.mockResolvedValue({ contractVersion: 2, runtimes: [] });

    await expect(detectTexRuntimes()).rejects.toThrow(
      "Unsupported TeX runtime diagnostic contract",
    );
  });

  test("exposes contract guard", () => {
    expect(
      isTexRuntimeDiagnostic({
        contractVersion: 1,
        hostOs: "linux",
        hostArch: "x86_64",
        runtimes: [],
        missingCoreTools: [],
        notes: [],
      }),
    ).toBe(true);
  });
});
