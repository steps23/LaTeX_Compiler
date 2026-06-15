import { openDB, DBSchema, IDBPDatabase } from "idb";
import {
  Project,
  FileNode,
  SyncAccount,
  SyncBinding,
  SyncOperation,
  SyncConflict,
  AppSettings,
} from "../types";

export interface TeXForgeDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
    indexes: { updatedAt: number; syncAccountId: string };
  };
  files: {
    key: string;
    value: FileNode;
    indexes: { projectId: string; "projectId, isDeleted": [string, number] }; // booleans in indices usually numbers 0 or 1, but IDB supports bools in some browsers, better use projectId directly and filter
  };
  syncAccounts: {
    key: string;
    value: SyncAccount;
  };
  syncBindings: {
    key: string;
    value: SyncBinding;
    indexes: { projectId: string; accountId: string };
  };
  syncQueue: {
    key: string;
    value: SyncOperation;
    indexes: { projectId: string; status: string };
  };
  syncConflicts: {
    key: string;
    value: SyncConflict;
    indexes: { projectId: string };
  };
  appSettings: {
    key: string;
    value: AppSettings;
  };
}

let dbPromise: Promise<IDBPDatabase<TeXForgeDB>> | null = null;

export async function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<TeXForgeDB>("texforge-db", 2, {
      async upgrade(db, oldVersion, newVersion, transaction) {
        if (oldVersion < 1) {
          const projectStore = db.createObjectStore("projects", {
            keyPath: "id",
          });
          projectStore.createIndex("updatedAt", "updatedAt");

          const fileStore = db.createObjectStore("files", { keyPath: "id" });
          fileStore.createIndex("projectId", "projectId");
        }

        if (oldVersion < 2) {
          // Add new stores
          if (!db.objectStoreNames.contains("syncAccounts")) {
            db.createObjectStore("syncAccounts", { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains("syncBindings")) {
            const bindingsStore = db.createObjectStore("syncBindings", {
              keyPath: "id",
            });
            bindingsStore.createIndex("projectId", "projectId");
            bindingsStore.createIndex("accountId", "accountId");
          }
          if (!db.objectStoreNames.contains("syncQueue")) {
            const queueStore = db.createObjectStore("syncQueue", {
              keyPath: "id",
            });
            queueStore.createIndex("projectId", "projectId");
            queueStore.createIndex("status", "status");
          }
          if (!db.objectStoreNames.contains("syncConflicts")) {
            const conflictsStore = db.createObjectStore("syncConflicts", {
              keyPath: "id",
            });
            conflictsStore.createIndex("projectId", "projectId");
          }
          if (!db.objectStoreNames.contains("appSettings")) {
            db.createObjectStore("appSettings", { keyPath: "id" });
          }

          // Migrate old projects and files to have new required fields
          // Since it's a version upgrade transaction, we can read/write data safely
          const projectStore = transaction.objectStore("projects");

          if (oldVersion === 1) {
            // Add new indices on existing stores
            if (!projectStore.indexNames.contains("syncAccountId")) {
              projectStore.createIndex("syncAccountId", "syncAccountId");
            }

            // Migrate projects
            let projectCursor = await projectStore.openCursor();
            while (projectCursor) {
              const project = projectCursor.value;
              let changed = false;
              if (!project.storageMode) {
                project.storageMode = "local";
                changed = true;
              }
              if (!project.syncStatus) {
                project.syncStatus = "local-only";
                changed = true;
              }
              if (changed) {
                await projectCursor.update(project);
              }
              projectCursor = await projectCursor.continue();
            }

            const fileStore = transaction.objectStore("files");
            let fileCursor = await fileStore.openCursor();
            while (fileCursor) {
              const file = fileCursor.value;
              let changed = false;
              if (file.isDeleted === undefined) {
                file.isDeleted = false;
                changed = true;
              }
              if (file.syncStatus === undefined) {
                file.syncStatus = "local-only";
                changed = true;
              }
              if (changed) {
                await fileCursor.update(file);
              }
              fileCursor = await fileCursor.continue();
            }
          }
        }
      },
    });
  }
  return dbPromise;
}
