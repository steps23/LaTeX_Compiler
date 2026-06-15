import { Project, FileNode } from "../types";
import JSZip from "jszip";
import { getFileName, normalizePath } from "./paths";
import { FileService } from "../services/FileService";
import { ProjectService } from "../services/ProjectService";

/**
 * Sorts projects by their update time descending.
 */
export function sortProjectsByRecent(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function exportProjectZip(
  project: Project,
  files: FileNode[],
  excludeGenerated: boolean = true,
) {
  const zip = new JSZip();

  for (const file of files) {
    if (file.isFolder || file.isDeleted) continue;

    if (excludeGenerated) {
      const isGenerated = file.name.match(
        /\.(aux|log|out|fls|fdb_latexmk|synctex(\.gz)?)$/i,
      );
      if (isGenerated) continue;
    }

    if (file.blob) {
      zip.file(file.path, file.blob);
    } else if (file.content !== undefined) {
      zip.file(file.path, file.content);
    }
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${project.name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importProjectZip(file: File): Promise<string> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);

  const projectId = crypto.randomUUID();
  const now = Date.now();

  const projectName = file.name.replace(/\.zip$/i, "");

  let mainFilePath = "main.tex"; // Fallback

  // Find a proper main file (the shortest .tex file path at root usually)
  const texFiles: string[] = [];
  loadedZip.forEach((relativePath, zipEntry) => {
    if (!zipEntry.dir && relativePath.endsWith(".tex")) {
      texFiles.push(relativePath);
    }
  });

  if (texFiles.length > 0) {
    // Find one named main.tex
    const mainTex = texFiles.find(
      (p) => getFileName(p).toLowerCase() === "main.tex",
    );
    if (mainTex) {
      mainFilePath = mainTex;
    } else {
      mainFilePath = texFiles[0]; // Just take the first one
    }
  }

  const project: Project = {
    id: projectId,
    name: projectName,
    createdAt: now,
    updatedAt: now,
    mainFilePath: mainFilePath,
    storageMode: "local",
    syncStatus: "local-only",
    settings: {
      compiler: "http-fallback",
      autoCompile: false,
      autoCompileDelayMs: 2000,
      fontSize: 14,
    },
  };

  await ProjectService.saveProject(project);

  const folderPaths = new Set<string>();

  for (const relativePath of Object.keys(loadedZip.files)) {
    const zipEntry = loadedZip.files[relativePath];
    if (zipEntry.dir) continue;

    // Skip hidden macos files
    if (
      relativePath.includes("__MACOSX") ||
      getFileName(relativePath).startsWith(".")
    )
      continue;

    const path = normalizePath(relativePath);
    if (!path) continue;

    // Auto-register parent folders
    const parts = path.split("/");
    let curr = "";
    for (let i = 0; i < parts.length - 1; i++) {
      curr = curr ? `${curr}/${parts[i]}` : parts[i];
      folderPaths.add(curr);
    }

    const isText = path.match(/\.(tex|bib|cls|sty|txt|md|csv|json)$/i);

    if (isText) {
      const content = await zipEntry.async("string");
      await FileService.saveFile({
        id: crypto.randomUUID(),
        projectId,
        path,
        name: getFileName(path),
        isFolder: false,
        content,
        updatedAt: now,
        isDeleted: false,
        syncStatus: "local-only",
      });
    } else {
      const buffer = await zipEntry.async("arraybuffer");
      const mimeMatch = path.match(/\.(png|jpg|jpeg|gif|webp|svg|pdf)$/i);
      let mimeType = "application/octet-stream";
      if (mimeMatch) {
        const ext = mimeMatch[1].toLowerCase();
        if (ext === "svg") mimeType = "image/svg+xml";
        else if (ext === "pdf") mimeType = "application/pdf";
        else mimeType = `image/${ext === "jpg" ? "jpeg" : ext}`;
      }

      await FileService.saveFile({
        id: crypto.randomUUID(),
        projectId,
        path,
        name: getFileName(path),
        isFolder: false,
        blob: new Blob([buffer], { type: mimeType }),
        updatedAt: now,
        isDeleted: false,
        syncStatus: "local-only",
      });
    }
  }

  // Save folders
  for (const folderPath of Array.from(folderPaths)) {
    await FileService.saveFile({
      id: crypto.randomUUID(),
      projectId,
      path: folderPath,
      name: getFileName(folderPath),
      isFolder: true,
      updatedAt: now,
      isDeleted: false,
      syncStatus: "local-only",
    });
  }

  return projectId;
}
