/**
 * Checks if a file path belongs to generated build artifacts
 * like .aux, .log, .out, .pdf (if generated).
 */
export function isGeneratedFile(path: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase();
  if (!ext) return false;
  const generatedExtensions = new Set([
    "aux",
    "log",
    "out",
    "toc",
    "bbl",
    "blg",
    "synctex.gz",
    "fls",
    "fdb_latexmk",
  ]);
  return generatedExtensions.has(ext);
}
