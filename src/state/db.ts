import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Project, FileNode } from '../types';

interface TeXForgeDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
    indexes: { 'updatedAt': number };
  };
  files: {
    key: string; // Composite projectI_path or ID? We use id
    value: FileNode;
    indexes: { 'projectId': string };
  };
}

let dbPromise: Promise<IDBPDatabase<TeXForgeDB>> | null = null;

export async function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<TeXForgeDB>('texforge-db', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('projects')) {
          const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
          projectStore.createIndex('updatedAt', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('files')) {
          const fileStore = db.createObjectStore('files', { keyPath: 'id' });
          fileStore.createIndex('projectId', 'projectId');
        }
      },
    });
  }
  return dbPromise;
}

export async function loadProjects(): Promise<Project[]> {
  const db = await getDB();
  return db.getAllFromIndex('projects', 'updatedAt');
}

export async function loadProject(id: string): Promise<Project | undefined> {
  const db = await getDB();
  return db.get('projects', id);
}

export async function saveProject(project: Project): Promise<void> {
  const db = await getDB();
  await db.put('projects', project);
}

export async function deleteProjectData(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['projects', 'files'], 'readwrite');
  await tx.objectStore('projects').delete(id);
  
  // Delete associated files
  const fileStore = tx.objectStore('files');
  const index = fileStore.index('projectId');
  const keys = await index.getAllKeys(id);
  for (const key of keys) {
    await fileStore.delete(key);
  }
  await tx.done;
}

export async function loadFiles(projectId: string): Promise<FileNode[]> {
  const db = await getDB();
  return db.getAllFromIndex('files', 'projectId', projectId);
}

export async function saveFileNode(file: FileNode): Promise<void> {
  const db = await getDB();
  await db.put('files', file);
}

export async function deleteFileNode(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('files', id);
}
