import { invoke } from "@tauri-apps/api/core";
import type { FileNode, Project, SyncOperation } from "../types";

type NativeFilePayload = Omit<FileNode, "blob"> & {
  binaryBytes?: number[];
};

const blobToBytes = async (blob: Blob): Promise<number[]> =>
  Array.from(new Uint8Array(await blob.arrayBuffer()));

const toNativeFilePayload = async (
  file: FileNode,
): Promise<NativeFilePayload> => {
  const { blob, ...rest } = file;
  if (!blob) return rest;
  return { ...rest, binaryBytes: await blobToBytes(blob) };
};

const fromNativeFilePayload = (payload: NativeFilePayload): FileNode => {
  const { binaryBytes, ...file } = payload;
  if (!binaryBytes) return file;
  return { ...file, blob: new Blob([new Uint8Array(binaryBytes)]) };
};

export const NativeProjectRepo = {
  async getAll(): Promise<Project[]> {
    return await invoke<Project[]>("get_all_projects");
  },
  async getById(id: string): Promise<Project | undefined> {
    return await invoke<Project | null>("get_project", { id }).then(
      (project) => project ?? undefined,
    );
  },
  async save(project: Project): Promise<void> {
    await invoke("save_project", { project });
  },
  async delete(id: string): Promise<void> {
    await invoke("delete_project", { id });
  },
};

export const NativeFileRepo = {
  async getByProjectId(projectId: string): Promise<FileNode[]> {
    const files = await invoke<NativeFilePayload[]>("get_project_files", {
      projectId,
    });
    return files.map(fromNativeFilePayload);
  },
  async getById(id: string): Promise<FileNode | undefined> {
    const file = await invoke<NativeFilePayload | null>("get_file", { id });
    return file ? fromNativeFilePayload(file) : undefined;
  },
  async save(file: FileNode): Promise<void> {
    await invoke("save_file", { file: await toNativeFilePayload(file) });
  },
  async delete(id: string): Promise<void> {
    await invoke("delete_file", { id });
  },
  async atomicUpdateWithQueueAndProject(
    file: FileNode,
    project: Project,
    _syncOp?: SyncOperation,
  ): Promise<void> {
    await invoke("save_project", { project });
    await invoke("save_file", { file: await toNativeFilePayload(file) });
  },
  async atomicSoftDeleteWithQueueAndProject(
    file: FileNode,
    project: Project,
    _syncOp: SyncOperation,
  ): Promise<void> {
    await invoke("save_project", { project });
    await invoke("save_file", { file: await toNativeFilePayload(file) });
  },
  async atomicHardDeleteWithProjectUpdate(
    fileId: string,
    project: Project,
  ): Promise<void> {
    await invoke("save_project", { project });
    await invoke("delete_file", { id: fileId });
  },
};
