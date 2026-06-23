import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "./runtime";

export const TEX_RUNTIME_CONTRACT_VERSION = 1 as const;

export type TexDistributionKind =
  | "mac-tex"
  | "tex-live"
  | "mik-tex"
  | "unknown";
export type TexToolStatus = "available" | "version-failed";
export type TexRuntimeStatus = "available" | "partial";
export type PackageManagerKind = "tlmgr" | "mpm" | "none";

export type TexTool = {
  name: string;
  path: string;
  version: string | null;
  status: TexToolStatus;
  diagnostic: string | null;
};

export type TexRuntimeCapabilities = {
  canCompilePdf: boolean;
  hasBibliography: boolean;
  hasPackageManager: boolean;
  hasSynctex: boolean;
};

export type TexRuntime = {
  id: string;
  distribution: TexDistributionKind;
  version: string | null;
  arch: string;
  rootDir: string | null;
  binDir: string;
  tools: TexTool[];
  packageManager: PackageManagerKind;
  status: TexRuntimeStatus;
  detectionSource: string;
  compatibleWithHost: boolean;
  capabilities: TexRuntimeCapabilities;
};

export type TexRuntimeDiagnostic = {
  contractVersion: typeof TEX_RUNTIME_CONTRACT_VERSION;
  hostOs: string;
  hostArch: string;
  runtimes: TexRuntime[];
  missingCoreTools: string[];
  notes: string[];
};

export type TexRuntimeSelection = {
  contractVersion: typeof TEX_RUNTIME_CONTRACT_VERSION;
  selectedRuntimeId: string | null;
  selectedBinDir: string | null;
  updatedAt: number | null;
};

const browserDiagnostic: TexRuntimeDiagnostic = {
  contractVersion: TEX_RUNTIME_CONTRACT_VERSION,
  hostOs: "web",
  hostArch: "unknown",
  runtimes: [],
  missingCoreTools: ["latexmk", "pdflatex", "xelatex", "lualatex"],
  notes: [
    "Native LaTeX runtime detection is available only in the Tauri desktop runtime.",
  ],
};

const distributions: TexDistributionKind[] = [
  "mac-tex",
  "tex-live",
  "mik-tex",
  "unknown",
];
const toolStatuses: TexToolStatus[] = ["available", "version-failed"];
const runtimeStatuses: TexRuntimeStatus[] = ["available", "partial"];
const packageManagers: PackageManagerKind[] = ["tlmgr", "mpm", "none"];
const browserSelectionKey = "texforge.texRuntimeSelection.v1";

const emptySelection: TexRuntimeSelection = {
  contractVersion: TEX_RUNTIME_CONTRACT_VERSION,
  selectedRuntimeId: null,
  selectedBinDir: null,
  updatedAt: null,
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isTexTool = (value: unknown): value is TexTool => {
  if (typeof value !== "object" || value === null) return false;
  const tool = value as Record<string, unknown>;
  return (
    typeof tool.name === "string" &&
    typeof tool.path === "string" &&
    (typeof tool.version === "string" || tool.version === null) &&
    toolStatuses.includes(tool.status as TexToolStatus) &&
    (typeof tool.diagnostic === "string" || tool.diagnostic === null)
  );
};

const isCapabilities = (value: unknown): value is TexRuntimeCapabilities => {
  if (typeof value !== "object" || value === null) return false;
  const capabilities = value as Record<string, unknown>;
  return (
    typeof capabilities.canCompilePdf === "boolean" &&
    typeof capabilities.hasBibliography === "boolean" &&
    typeof capabilities.hasPackageManager === "boolean" &&
    typeof capabilities.hasSynctex === "boolean"
  );
};

const isTexRuntime = (value: unknown): value is TexRuntime => {
  if (typeof value !== "object" || value === null) return false;
  const runtime = value as Record<string, unknown>;
  return (
    typeof runtime.id === "string" &&
    distributions.includes(runtime.distribution as TexDistributionKind) &&
    (typeof runtime.version === "string" || runtime.version === null) &&
    typeof runtime.arch === "string" &&
    (typeof runtime.rootDir === "string" || runtime.rootDir === null) &&
    typeof runtime.binDir === "string" &&
    Array.isArray(runtime.tools) &&
    runtime.tools.every(isTexTool) &&
    packageManagers.includes(runtime.packageManager as PackageManagerKind) &&
    runtimeStatuses.includes(runtime.status as TexRuntimeStatus) &&
    typeof runtime.detectionSource === "string" &&
    typeof runtime.compatibleWithHost === "boolean" &&
    isCapabilities(runtime.capabilities)
  );
};

export const isTexRuntimeSelection = (
  value: unknown,
): value is TexRuntimeSelection => {
  if (typeof value !== "object" || value === null) return false;
  const selection = value as Record<string, unknown>;
  return (
    selection.contractVersion === TEX_RUNTIME_CONTRACT_VERSION &&
    (typeof selection.selectedRuntimeId === "string" ||
      selection.selectedRuntimeId === null) &&
    (typeof selection.selectedBinDir === "string" ||
      selection.selectedBinDir === null) &&
    (typeof selection.updatedAt === "number" || selection.updatedAt === null)
  );
};

export const isTexRuntimeDiagnostic = (
  value: unknown,
): value is TexRuntimeDiagnostic => {
  if (typeof value !== "object" || value === null) return false;
  const diagnostic = value as Record<string, unknown>;
  return (
    diagnostic.contractVersion === TEX_RUNTIME_CONTRACT_VERSION &&
    typeof diagnostic.hostOs === "string" &&
    typeof diagnostic.hostArch === "string" &&
    Array.isArray(diagnostic.runtimes) &&
    diagnostic.runtimes.every(isTexRuntime) &&
    isStringArray(diagnostic.missingCoreTools) &&
    isStringArray(diagnostic.notes)
  );
};

export const detectTexRuntimes = async (): Promise<TexRuntimeDiagnostic> => {
  if (!isTauri()) return browserDiagnostic;

  const diagnostic: unknown = await invoke("detect_tex_runtimes");
  if (!isTexRuntimeDiagnostic(diagnostic)) {
    throw new Error("Unsupported TeX runtime diagnostic contract");
  }
  return diagnostic;
};

export const getTexRuntimeSelection =
  async (): Promise<TexRuntimeSelection> => {
    if (!isTauri()) {
      const stored = window.localStorage.getItem(browserSelectionKey);
      if (!stored) return emptySelection;
      try {
        const value: unknown = JSON.parse(stored);
        return isTexRuntimeSelection(value) ? value : emptySelection;
      } catch {
        return emptySelection;
      }
    }

    const selection: unknown = await invoke("get_tex_runtime_selection");
    if (!isTexRuntimeSelection(selection)) {
      throw new Error("Unsupported TeX runtime selection contract");
    }
    return selection;
  };

export const saveTexRuntimeSelection = async (
  runtime: TexRuntime | null,
): Promise<TexRuntimeSelection> => {
  if (!isTauri()) {
    const selection: TexRuntimeSelection = runtime
      ? {
          contractVersion: TEX_RUNTIME_CONTRACT_VERSION,
          selectedRuntimeId: runtime.id,
          selectedBinDir: runtime.binDir,
          updatedAt: Date.now(),
        }
      : emptySelection;
    window.localStorage.setItem(browserSelectionKey, JSON.stringify(selection));
    return selection;
  }

  const selection: unknown = await invoke("save_tex_runtime_selection", {
    runtimeId: runtime?.id ?? null,
  });
  if (!isTexRuntimeSelection(selection)) {
    throw new Error("Unsupported TeX runtime selection contract");
  }
  return selection;
};
