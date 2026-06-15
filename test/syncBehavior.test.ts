import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { FileService } from "../src/services/FileService";
import { ProjectRepo, FileRepo, SyncQueueRepo } from "../src/db/repository";
import { Project, FileNode } from "../src/types";
import { getDB } from "../src/db/core";

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

  it("should generate upload sync operation for hybrid projects on save", async () => {
    const project: Project = {
      id: "p-hybrid",
      name: "Hybrid",
      createdAt: 0,
      updatedAt: 0,
      mainFilePath: "main.tex",
      storageMode: "hybrid",
      syncStatus: "synced",
      settings: {
        compiler: "http-fallback",
        autoCompile: false,
        autoCompileDelayMs: 0,
        fontSize: 14,
      },
    };
    await ProjectRepo.save(project);

    const file: FileNode = {
      id: "f2",
      projectId: "p-hybrid",
      path: "test.tex",
      name: "test.tex",
      isFolder: false,
      updatedAt: 0,
      syncStatus: "synced",
      remoteFileId: "123",
    };
    await FileService.saveFile(file);

    const queueOps = await SyncQueueRepo.getByProjectId("p-hybrid");
    expect(queueOps.length).toBe(1);
    expect(queueOps[0].type).toBe("upload");
    expect(queueOps[0].fileId).toBe("f2");

    const savedFile = await FileRepo.getById("f2");
    expect(savedFile?.syncStatus).toBe("pending");
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

  it("should soft delete remote files with an atomic queue operation", async () => {
    const project: Project = {
      id: "p-rem",
      name: "R",
      createdAt: 0,
      updatedAt: 0,
      mainFilePath: "a",
      storageMode: "drive",
      syncStatus: "synced",
      settings: {
        compiler: "wasm",
        autoCompile: false,
        autoCompileDelayMs: 0,
        fontSize: 14,
      },
    };
    await ProjectRepo.save(project);

    const file: FileNode = {
      id: "f4",
      projectId: "p-rem",
      path: "a",
      name: "a",
      isFolder: false,
      updatedAt: 0,
      syncStatus: "synced",
      remoteFileId: "remote1",
    };
    await FileRepo.save(file);

    await FileService.deleteFile("f4");

    const softDeleted = await FileRepo.getById("f4");
    expect(softDeleted).toBeDefined();
    expect(softDeleted?.isDeleted).toBe(true);
    expect(softDeleted?.syncStatus).toBe("pending");

    const ops = await SyncQueueRepo.getByProjectId("p-rem");
    expect(ops.length).toBe(1);
    expect(ops[0].type).toBe("delete");
    expect(ops[0].fileId).toBe("f4");
  });
});
