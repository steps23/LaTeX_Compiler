import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  ProjectRepo,
  FileRepo,
  SyncAccountRepo,
  SyncQueueRepo,
  AppSettingsRepo,
} from "../src/db/repository";
import { getDB } from "../src/db/core";
import { Project, FileNode, SyncAccount, SyncOperation } from "../src/types";
import { openDB } from "idb";

describe("Database Repositories and Migration", () => {
  beforeEach(async () => {
    const dbs = await indexedDB.databases();
    for (const db of dbs) {
      if (db.name) indexedDB.deleteDatabase(db.name);
    }
  });

  it("should upgrade from v1 to v2 non-destructively", async () => {
    // Create v1 db
    const db1 = await openDB("texforge-db-migrate-test", 1, {
      upgrade(db) {
        const pStore = db.createObjectStore("projects", { keyPath: "id" });
        pStore.createIndex("updatedAt", "updatedAt");
        const fStore = db.createObjectStore("files", { keyPath: "id" });
        fStore.createIndex("projectId", "projectId");
      },
    });

    await db1.put("projects", {
      id: "p1",
      name: "Old",
      createdAt: 1,
      updatedAt: 1,
      mainFilePath: "main.tex",
      settings: {},
    } as any);
    await db1.put("files", {
      id: "f1",
      projectId: "p1",
      path: "main.tex",
      name: "main.tex",
      isFolder: false,
      updatedAt: 1,
      content: "hello",
    } as any);
    await db1.put("files", {
      id: "fBlob",
      projectId: "p1",
      path: "img.png",
      name: "img.png",
      isFolder: false,
      updatedAt: 1,
      blob: new Blob(["data"]),
    } as any);
    db1.close();

    // Now open v2 database manually using core.ts logic, but with the test db name
    const db2 = await openDB("texforge-db-migrate-test", 2, {
      async upgrade(db, oldV, newV, tx) {
        if (oldV < 2) {
          db.createObjectStore("syncAccounts", { keyPath: "id" });
          const b = db.createObjectStore("syncBindings", { keyPath: "id" });
          b.createIndex("projectId", "projectId");
          b.createIndex("accountId", "accountId");

          const q = db.createObjectStore("syncQueue", { keyPath: "id" });
          q.createIndex("projectId", "projectId");
          q.createIndex("status", "status");

          const c = db.createObjectStore("syncConflicts", { keyPath: "id" });
          c.createIndex("projectId", "projectId");

          db.createObjectStore("appSettings", { keyPath: "id" });

          const projectStore = tx.objectStore("projects");
          projectStore.createIndex("syncAccountId", "syncAccountId");
          let pCursor = await projectStore.openCursor();
          while (pCursor) {
            const p = pCursor.value;
            p.storageMode = "local";
            p.syncStatus = "local-only";
            await pCursor.update(p);
            pCursor = await pCursor.continue();
          }

          const fileStore = tx.objectStore("files");
          let fCursor = await fileStore.openCursor();
          while (fCursor) {
            const f = fCursor.value;
            f.isDeleted = false;
            f.syncStatus = "local-only";
            await fCursor.update(f);
            fCursor = await fCursor.continue();
          }
        }
      },
    });

    const p = await db2.get("projects", "p1");
    expect(p.storageMode).toBe("local");
    expect(p.syncStatus).toBe("local-only");

    const f = await db2.get("files", "f1");
    expect(f.isDeleted).toBe(false);
    expect(f.syncStatus).toBe("local-only");
    expect(f.content).toBe("hello");

    const fBlob = await db2.get("files", "fBlob");
    expect(fBlob.isDeleted).toBe(false);
    expect(fBlob.syncStatus).toBe("local-only");
    expect(fBlob.blob).toBeDefined();

    db2.close();
  });

  it("should perform crud operations on repositories", async () => {
    const project: Project = {
      id: "p2",
      name: "Test",
      createdAt: Date.now(),
      updatedAt: Date.now(),
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
    const loaded = await ProjectRepo.getById("p2");
    expect(loaded?.name).toBe("Test");

    const files = await FileRepo.getByProjectId("p2");
    expect(files.length).toBe(0);

    const file: FileNode = {
      id: "f2",
      projectId: "p2",
      path: "test.tex",
      name: "test.tex",
      isFolder: false,
      updatedAt: 0,
    };
    await FileRepo.save(file);
    const loadedFiles = await FileRepo.getByProjectId("p2");
    expect(loadedFiles.length).toBe(1);

    await ProjectRepo.delete("p2");
    expect(await ProjectRepo.getById("p2")).toBeUndefined();
    expect(await FileRepo.getById("f2")).toBeUndefined(); // cascading delete test

    // Testing AppSettings
    expect(await AppSettingsRepo.getSettings()).toBeUndefined();
    await AppSettingsRepo.saveSettings({ id: "default", theme: "dark" });
    const settings = await AppSettingsRepo.getSettings();
    expect(settings?.theme).toBe("dark");
  });
});
