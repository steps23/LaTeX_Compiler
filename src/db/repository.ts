import { getDB } from "./core";
import { Project, FileNode, SyncOperation, AppSettings } from "../types";

// Project Repository
export const ProjectRepo = {
  async getAll(): Promise<Project[]> {
    const db = await getDB();
    const projects = await db.getAllFromIndex("projects", "updatedAt");
    return projects; // Descending sort can be done in service or UI
  },
  async getById(id: string): Promise<Project | undefined> {
    const db = await getDB();
    return db.get("projects", id);
  },
  async save(project: Project): Promise<void> {
    const db = await getDB();
    await db.put("projects", project);
  },
  async delete(id: string): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(
      ["projects", "files", "syncBindings", "syncQueue", "syncConflicts"],
      "readwrite",
    );
    await tx.objectStore("projects").delete(id);

    // Delete associated files
    const fileStore = tx.objectStore("files");
    const filesIndex = fileStore.index("projectId");
    let cursor = await filesIndex.openCursor(id);
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }

    // Delete sync bindings
    const bindingsStore = tx.objectStore("syncBindings");
    const bindingsIndex = bindingsStore.index("projectId");
    let bindingsCursor = await bindingsIndex.openCursor(id);
    while (bindingsCursor) {
      await bindingsCursor.delete();
      bindingsCursor = await bindingsCursor.continue();
    }

    // Delete sync queue
    const queueStore = tx.objectStore("syncQueue");
    const queueIndex = queueStore.index("projectId");
    let queueCursor = await queueIndex.openCursor(id);
    while (queueCursor) {
      await queueCursor.delete();
      queueCursor = await queueCursor.continue();
    }

    // Delete sync conflicts
    const conflictsStore = tx.objectStore("syncConflicts");
    const conflictsIndex = conflictsStore.index("projectId");
    let conflictsCursor = await conflictsIndex.openCursor(id);
    while (conflictsCursor) {
      await conflictsCursor.delete();
      conflictsCursor = await conflictsCursor.continue();
    }

    await tx.done;
  },
};

// File Repository
export const FileRepo = {
  async getByProjectId(projectId: string): Promise<FileNode[]> {
    const db = await getDB();
    return db.getAllFromIndex("files", "projectId", projectId);
  },
  async getById(id: string): Promise<FileNode | undefined> {
    const db = await getDB();
    return db.get("files", id);
  },
  async save(file: FileNode): Promise<void> {
    const db = await getDB();
    await db.put("files", file);
  },
  async delete(id: string): Promise<void> {
    const db = await getDB();
    await db.delete("files", id);
  },
  async atomicUpdateWithQueueAndProject(
    file: FileNode,
    project: Project,
    syncOp?: SyncOperation,
  ): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(["files", "projects", "syncQueue"], "readwrite");
    await tx.objectStore("files").put(file);
    await tx.objectStore("projects").put(project);
    if (syncOp) {
      await tx.objectStore("syncQueue").put(syncOp);
    }
    await tx.done;
  },
  async atomicSoftDeleteWithQueueAndProject(
    file: FileNode,
    project: Project,
    syncOp: SyncOperation,
  ): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(["files", "projects", "syncQueue"], "readwrite");
    await tx.objectStore("files").put(file);
    await tx.objectStore("projects").put(project);
    await tx.objectStore("syncQueue").put(syncOp);
    await tx.done;
  },
  async atomicHardDeleteWithProjectUpdate(
    fileId: string,
    project: Project,
  ): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(["files", "projects", "syncQueue"], "readwrite");
    await tx.objectStore("files").delete(fileId);
    await tx.objectStore("projects").put(project);

    // Clean up any pending sync operations for this file
    const queueStore = tx.objectStore("syncQueue");
    const index = queueStore.index("projectId");
    let cursor = await index.openCursor(project.id);
    while (cursor) {
      if (cursor.value.fileId === fileId) {
        await cursor.delete();
      }
      cursor = await cursor.continue();
    }
    await tx.done;
  },
};

// AppSettings Repository
export const AppSettingsRepo = {
  async getSettings(): Promise<AppSettings | undefined> {
    const db = await getDB();
    return db.get("appSettings", "default");
  },
  async saveSettings(settings: AppSettings): Promise<void> {
    const db = await getDB();
    await db.put("appSettings", settings);
  },
};

export const SyncQueueRepo = {
  async getByProjectId(projectId: string): Promise<SyncOperation[]> {
    const db = await getDB();
    return db.getAllFromIndex("syncQueue", "projectId", projectId);
  },
  async push(operation: SyncOperation): Promise<void> {
    const db = await getDB();
    await db.put("syncQueue", operation);
  },
  async remove(id: string): Promise<void> {
    const db = await getDB();
    await db.delete("syncQueue", id);
  },
};
