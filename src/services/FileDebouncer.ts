import { FileNode } from "../types";
import { FileService } from "./FileService";

const debouncedSaves: Map<string, NodeJS.Timeout> = new Map();
const pendingSaves: Map<string, FileNode> = new Map();

type ErrorHandler = (error: Error, file: FileNode) => void;
let errorHandler: ErrorHandler | null = null;

export function setErrorHandler(handler: ErrorHandler) {
  errorHandler = handler;
}

async function doSave(file: FileNode, isFlush: boolean = false) {
  try {
    await FileService.saveFile(file);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("Failed to save file", file.id, err);
    if (errorHandler) {
      errorHandler(err, file);
    }
    if (isFlush) throw err;
  }
}

export function schedule(file: FileNode, delayMs = 1000) {
  pendingSaves.set(file.id, file);

  const existingTimeout = debouncedSaves.get(file.id);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }

  const timeout = setTimeout(async () => {
    const pendingFile = pendingSaves.get(file.id);
    if (pendingFile) {
      pendingSaves.delete(file.id);
      debouncedSaves.delete(file.id);
      await doSave(pendingFile);
    }
  }, delayMs);

  debouncedSaves.set(file.id, timeout);
}

export async function flushAll(): Promise<void> {
  const saves = Array.from(pendingSaves.values());
  pendingSaves.clear();

  for (const timeout of debouncedSaves.values()) {
    clearTimeout(timeout);
  }
  debouncedSaves.clear();

  await Promise.all(saves.map((file) => doSave(file, true)));
}

export async function flushFile(fileId: string): Promise<void> {
  const pendingFile = pendingSaves.get(fileId);
  if (pendingFile) {
    pendingSaves.delete(fileId);
    const timeout = debouncedSaves.get(fileId);
    if (timeout) clearTimeout(timeout);
    debouncedSaves.delete(fileId);
    await doSave(pendingFile, true);
  }
}

export async function flushProject(projectId: string): Promise<void> {
  const saves: FileNode[] = [];
  for (const [id, file] of pendingSaves.entries()) {
    if (file.projectId === projectId) {
      saves.push(file);
      pendingSaves.delete(id);
      const timeout = debouncedSaves.get(id);
      if (timeout) clearTimeout(timeout);
      debouncedSaves.delete(id);
    }
  }
  await Promise.all(saves.map((file) => doSave(file, true)));
}

export function cancel(fileId: string): void {
  pendingSaves.delete(fileId);
  const timeout = debouncedSaves.get(fileId);
  if (timeout) clearTimeout(timeout);
  debouncedSaves.delete(fileId);
}
