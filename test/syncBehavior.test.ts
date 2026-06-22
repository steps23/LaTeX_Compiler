import { describe, it, expect, beforeEach } from "vitest";
import { FileService } from "../src/services/FileService";
import { ProjectRepo, FileRepo, SyncQueueRepo } from "../src/db/repository";
import { Project, FileNode } from "../src/types";

describe("Sync Behavior & FileService", () => {
  beforeEach(async () => {
    const dbs = await indexedDB.databases();
    for (const db of dbs) {
      if (db.name) indexedDB.deleteDatabase(db.name);
    }
  });

  it("should not generate sync operations for local-only projects on save", async () => {
    const project: Project = {
      id: "p-local",
      name: "Local",
      createdAt: 0,
      updatedAt: 0,
      mainFilePath: "main.tex",
      storageMode: "local",
      syncStatus: "local-only",
      settings: {
        compiler: "http-fallback",
        autoCompile: false,
        autoCompileDelayMs: 0,
        fontSize: 14,
      },
    };
    await ProjectRepo.save(project);

    const file: FileNode = {
      id: "f1",
      projectId: "p-local",
      path: "test.tex",
      name: "test.tex",
      isFolder: false,
      updatedAt: 0,
      syncStatus: "local-only",
    };
    await FileService.saveFile(file);

    const queueOps = await SyncQueueRepo.getByProjectId("p-local");
    expect(queueOps.length).toBe(0);
  });

  it("should hard delete local-only files", async () => {
    const project: Project = {
      id: "p-loc",
      name: "L",
      createdAt: 0,
      updatedAt: 0,
      mainFilePath: "a",
      storageMode: "local",
      syncStatus: "local-only",
      settings: {
        compiler: "wasm",
        autoCompile: false,
        autoCompileDelayMs: 0,
        fontSize: 14,
      },
    };
    await ProjectRepo.save(project);

    const file: FileNode = {
      id: "f3",
      projectId: "p-loc",
      path: "a",
      name: "a",
      isFolder: false,
      updatedAt: 0,
      syncStatus: "local-only",
    };
    await FileRepo.save(file);

    await FileService.deleteFile("f3");

    const deletedFile = await FileRepo.getById("f3");
    expect(deletedFile).toBeUndefined(); // hard delete

    const ops = await SyncQueueRepo.getByProjectId("p-loc");
    expect(ops.length).toBe(0);
  });
});
