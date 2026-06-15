/**
 * Normalizes a file path to eliminate redundant parts like '.' and '..',
 * and replaces backward slashes with forward slashes.
 */
export function normalizePath(path: string): string {
  if (!path) return "";
  // String null bytes
  if (path.indexOf("\0") !== -1) return "";
  path = path.replace(/\\/g, "/");
  const parts = path.split("/");
  const stack: string[] = [];

  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (stack.length > 0 && stack[stack.length - 1] !== "..") {
        stack.pop();
      } else {
        stack.push("..");
      }
    } else {
      stack.push(part);
    }
  }

  return stack.join("/");
}

/**
 * Validates a file path to ensure it doesn't try to access outside the project root.
 */
export function isValidProjectFilePath(path: string): boolean {
  if (!path) return false;
  if (path.startsWith("/") || path.startsWith("\\")) return false;
  const normalized = normalizePath(path);
  if (!normalized) return false;
  if (normalized.startsWith("..")) return false;
  return true;
}

/**
 * Extracts the parent path from a given path.
 */
export function getParentPath(path: string): string | undefined {
  const normalized = normalizePath(path);
  const lastSlashIndex = normalized.lastIndexOf("/");
  if (lastSlashIndex === -1) return undefined;
  return normalized.substring(0, lastSlashIndex);
}

/**
 * Extracts the file or folder name from a given path.
 */
export function getFileName(path: string): string {
  const normalized = normalizePath(path);
  const lastSlashIndex = normalized.lastIndexOf("/");
  if (lastSlashIndex === -1) return normalized;
  return normalized.substring(lastSlashIndex + 1);
}

/**
 * Validates a file/folder name.
 */
export function isValidName(name: string): boolean {
  if (!name || name.trim() === "") return false;
  if (name.includes("/") || name.includes("\\")) return false;
  if (name === "." || name === "..") return false;
  return true;
}

/**
 * Checks if path represents a descendant of parentPath
 */
export function isDescendant(path: string, parentPath: string): boolean {
  const normPath = normalizePath(path);
  const normParent = normalizePath(parentPath);
  return normPath.startsWith(normParent + "/");
}
