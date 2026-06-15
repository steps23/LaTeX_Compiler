import { FileRepo, ProjectRepo } from "../db/repository";
import { FileNode, SyncOperation } from "../types";
import { computeTextHash, computeBlobHash } from "../utils/crypto";

export const FileService = {
  async getProjectFiles(projectId: string): Promise<FileNode[]> {
    return await FileRepo.getByProjectId(projectId);
  },

  async getFile(id: string): Promise<FileNode | undefined> {
    return await FileRepo.getById(id);
  },

  async saveFile(file: FileNode): Promise<void> {
    file.updatedAt = Date.now();

    // Compute hash for syncing purposes
    if (file.content !== undefined) {
      file.hash = await computeTextHash(file.content);
      file.size = new Blob([file.content]).size;
    } else if (file.blob) {
      file.hash = await computeBlobHash(file.blob);
      file.size = file.blob.size;
    }

    const project = await ProjectRepo.getById(file.projectId);
    if (!project) {
      // If project somehow doesn't exist, fallback to saving just the file
      await FileRepo.save(file);
      return;
    }

    project.updatedAt = file.updatedAt;

    let syncOp: SyncOperation | undefined;
    if (project.storageMode !== "local") {
      file.syncStatus = "pending";
      syncOp = {
        id: crypto.randomUUID(),
        projectId: project.id,
        fileId: file.id,
        type: "upload",
        status: "queued",
        retryCount: 0,
        queuedAt: Date.now(),
      };
    }

    await FileRepo.atomicUpdateWithQueueAndProject(file, project, syncOp);
  },

  async deleteFile(id: string): Promise<void> {
    const file = await FileRepo.getById(id);
    if (!file || file.isDeleted) return;

    const project = await ProjectRepo.getById(file.projectId);
    const now = Date.now();

    if (project) {
      project.updatedAt = now;
      await FileRepo.atomicHardDeleteWithProjectUpdate(id, project);
    } else {
      await FileRepo.delete(id);
    }
  },
};
