import { create } from "zustand";
import { Project, FileNode, CompileResult } from "../types";
import { ProjectService } from "../services/ProjectService";
import { FileService } from "../services/FileService";
import { schedule, flushProject, flushFile } from "../services/FileDebouncer";
import {
  normalizePath,
  getFileName,
  isValidName,
  isValidProjectFilePath,
  isDescendant,
} from "../utils/paths";
import type { editor } from "monaco-editor";

export interface EditorState {
  // Global View
  currentProject: Project | null;
  projects: Project[];

  // Project State
  files: FileNode[];
  activeFileId: string | null;
  openFiles: string[];
  expandedSubfolders: Record<string, boolean>;
  editorViewStates: Record<string, editor.ICodeEditorViewState | null>;
  activeLine: number | null;
  isCompiling: boolean;
  compileResult: CompileResult | null;
  logsVisible: boolean;

  // Actions
  loadInitialState: () => Promise<void>;
  createExampleProject: () => Promise<void>;
  createEmptyProject: (
    name: string,
    template: "empty" | "article" | "report",
    mainFile: string,
  ) => Promise<string>;
  openProject: (projectId: string) => Promise<void>;
  closeProject: () => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  renameProject: (projectId: string, newName: string) => Promise<void>;
  duplicateProject: (projectId: string) => Promise<string>;
  setProjectMainFile: (filePath: string) => Promise<void>;
  setProjectTexRuntime: (runtimeId: string | null | undefined) => Promise<void>;

  // File Actions
  setActiveFile: (fileId: string) => Promise<void>;
  closeFileAndTab: (fileId: string) => Promise<void>;
  setEditorViewState: (
    fileId: string,
    state: editor.ICodeEditorViewState | null,
  ) => void;
  goToLine: (fileId: string, line: number) => void;
  updateFileContent: (fileId: string, content: string) => void;
  createFile: (
    name: string,
    isFolder: boolean,
    parentPath: string,
    content?: string,
    blob?: Blob,
  ) => Promise<void>;
  deleteFile: (fileId: string) => Promise<void>;
  renameFileNode: (fileId: string, newName: string) => Promise<void>;
  moveFileNode: (fileId: string, newParentPath: string) => Promise<void>;
  duplicateFileNode: (fileId: string) => Promise<void>;
  toggleFolderExpansion: (path: string, expand?: boolean) => void;

  // Compile Actions
  setCompiling: (compiling: boolean) => void;
  setCompileResult: (result: CompileResult) => void;
  toggleLogs: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  currentProject: null,
  projects: [],
  files: [],
  activeFileId: null,
  openFiles: [],
  expandedSubfolders: {},
  editorViewStates: {},
  activeLine: null,
  isCompiling: false,
  compileResult: null,
  logsVisible: false,

  loadInitialState: async () => {
    const projects = await ProjectService.getAllProjects();
    set({ projects });
  },

  createExampleProject: async () => {
    const projectId = crypto.randomUUID();
    const now = Date.now();

    const project: Project = {
      id: projectId,
      name: "Example Article",
      createdAt: now,
      updatedAt: now,
      mainFilePath: "main.tex",
      storageMode: "local",
      syncStatus: "local-only",
      settings: {
        compiler: "http-fallback",
        autoCompile: false,
        autoCompileDelayMs: 2000,
        fontSize: 14,
      },
    };

    const mainFile: FileNode = {
      id: crypto.randomUUID(),
      projectId,
      path: "main.tex",
      name: "main.tex",
      isFolder: false,
      updatedAt: now,
      isDeleted: false,
      syncStatus: "local-only",
      content: `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{graphicx}
\\usepackage{hyperref}

\\title{Welcome to TeXForge}
\\author{Guest User}
\\date{\\today}

\\begin{document}

\\maketitle

\\section{Introduction}
Welcome to \\textbf{TeXForge}, an online collaborative LaTeX editor. 

This is a guest mode project. It relies on IndexedDB to store your files securely in your browser. 

\\subsection{Features}
\\begin{itemize}
    \\item Responsive Layout
    \\item Monaco Editor integration
    \\item Client-side PDF rendering
    \\item Live compiling capabilities
\\end{itemize}

\\begin{equation}
    E = mc^2
\\end{equation}

\\end{document}`,
    };

    const bibFile: FileNode = {
      id: crypto.randomUUID(),
      projectId,
      path: "references.bib",
      name: "references.bib",
      isFolder: false,
      updatedAt: now,
      isDeleted: false,
      syncStatus: "local-only",
      content: `@article{example,
  title={An Example Reference},
  author={Doe, John},
  journal={Journal of TeX},
  year={2026}
}`,
    };

    await ProjectService.saveProject(project);
    await FileService.saveFile(mainFile);
    await FileService.saveFile(bibFile);

    const projects = await ProjectService.getAllProjects();
    set({ projects });

    await get().openProject(projectId);
  },

  createEmptyProject: async (name, template, mainFilePath) => {
    const projectId = crypto.randomUUID();
    const now = Date.now();

    const project: Project = {
      id: projectId,
      name,
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

    let content = "";
    if (template === "article") {
      content = `\\documentclass{article}\n\\usepackage[utf8]{inputenc}\n\n\\title{${name}}\n\\author{}\n\\date{\\today}\n\n\\begin{document}\n\\maketitle\n\n\\section{Introduction}\n\n\\end{document}`;
    } else if (template === "report") {
      content = `\\documentclass{report}\n\\usepackage[utf8]{inputenc}\n\n\\title{${name}}\n\\author{}\n\\date{\\today}\n\n\\begin{document}\n\\maketitle\n\\tableofcontents\n\n\\chapter{Introduction}\n\n\\end{document}`;
    }

    const mainFile: FileNode = {
      id: crypto.randomUUID(),
      projectId,
      path: mainFilePath,
      name: mainFilePath,
      isFolder: false,
      updatedAt: now,
      isDeleted: false,
      syncStatus: "local-only",
      content,
    };

    await ProjectService.saveProject(project);
    await FileService.saveFile(mainFile);

    const projects = await ProjectService.getAllProjects();
    set({ projects });

    return projectId;
  },

  openProject: async (projectId: string) => {
    const { currentProject } = get();
    if (currentProject) {
      await flushProject(currentProject.id);
    }
    const project = await ProjectService.getProject(projectId);
    if (!project) return;

    let files = await FileService.getProjectFiles(projectId);
    files = files.filter((f) => !f.isDeleted);
    const mainFile =
      files.find((f) => f.path === project.mainFilePath) ||
      files.find((f) => !f.isFolder);

    let expanded = {};
    try {
      const stored = localStorage.getItem(`project_${projectId}_expand`);
      if (stored) {
        expanded = JSON.parse(stored);
      }
    } catch {
      // Ignore
    }

    set({
      currentProject: project,
      files,
      activeFileId: mainFile?.id || null,
      openFiles: mainFile ? [mainFile.id] : [],
      expandedSubfolders: expanded,
      editorViewStates: {},
      compileResult: null,
      logsVisible: false,
    });
  },

  closeProject: async () => {
    const { currentProject } = get();
    if (currentProject) {
      await flushProject(currentProject.id);
    }
    set({
      currentProject: null,
      files: [],
      activeFileId: null,
      openFiles: [],
      expandedSubfolders: {},
      editorViewStates: {},
      compileResult: null,
      logsVisible: false,
    });
  },

  deleteProject: async (projectId: string) => {
    const { currentProject } = get();
    if (currentProject?.id === projectId) {
      await get().closeProject();
    }
    await ProjectService.deleteProject(projectId);
    const projects = await ProjectService.getAllProjects();
    set({ projects });
  },

  renameProject: async (projectId: string, newName: string) => {
    const project = await ProjectService.getProject(projectId);
    if (!project) return;

    project.name = newName;
    await ProjectService.saveProject(project);

    const { currentProject } = get();
    if (currentProject?.id === projectId) {
      set({ currentProject: { ...project } });
    }

    const projects = await ProjectService.getAllProjects();
    set({ projects });
  },

  duplicateProject: async (projectId: string) => {
    const project = await ProjectService.getProject(projectId);
    if (!project) throw new Error("Project not found");

    const newProjectId = crypto.randomUUID();
    const now = Date.now();

    const newProject: Project = {
      ...project,
      id: newProjectId,
      name: `${project.name} (Copy)`,
      createdAt: now,
      updatedAt: now,
    };

    const files = await FileService.getProjectFiles(projectId);
    const newFiles = files.map((file) => ({
      ...file,
      id: crypto.randomUUID(),
      projectId: newProjectId,
      updatedAt: now,
    }));

    await ProjectService.saveProject(newProject);
    for (const file of newFiles) {
      await FileService.saveFile(file);
    }

    const projects = await ProjectService.getAllProjects();
    set({ projects });

    return newProjectId;
  },

  setProjectMainFile: async (filePath: string) => {
    const { currentProject } = get();
    if (!currentProject) return;

    const newProject = { ...currentProject, mainFilePath: filePath };
    await ProjectService.saveProject(newProject);
    set({ currentProject: newProject });
  },

  setProjectTexRuntime: async (runtimeId: string | null | undefined) => {
    const { currentProject, projects } = get();
    if (!currentProject) return;

    const now = Date.now();
    const newProject: Project = {
      ...currentProject,
      updatedAt: now,
      settings: {
        ...currentProject.settings,
        texRuntimeId: runtimeId,
      },
    };
    await ProjectService.saveProject(newProject);
    set({
      currentProject: newProject,
      projects: [
        ...projects.filter((project) => project.id !== newProject.id),
        newProject,
      ].sort((a, b) => b.updatedAt - a.updatedAt),
    });
  },

  setActiveFile: async (fileId: string) => {
    const { activeFileId, openFiles } = get();
    if (activeFileId && activeFileId !== fileId) {
      await flushFile(activeFileId);
    }
    const newOpenFiles = [...openFiles];
    if (!newOpenFiles.includes(fileId)) {
      newOpenFiles.push(fileId);
    }
    set({ activeFileId: fileId, openFiles: newOpenFiles, activeLine: null });
  },

  closeFileAndTab: async (fileId: string) => {
    const { activeFileId, openFiles, editorViewStates } = get();
    await flushFile(fileId);
    const newOpenFiles = openFiles.filter((id) => id !== fileId);
    let newActiveFileId = activeFileId;
    if (activeFileId === fileId) {
      newActiveFileId =
        newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1] : null;
    }
    const newViewStates = { ...editorViewStates };
    delete newViewStates[fileId];

    set({
      openFiles: newOpenFiles,
      activeFileId: newActiveFileId,
      editorViewStates: newViewStates,
    });
  },

  setEditorViewState: (
    fileId: string,
    state: editor.ICodeEditorViewState | null,
  ) => {
    const { editorViewStates } = get();
    set({
      editorViewStates: {
        ...editorViewStates,
        [fileId]: state,
      },
    });
  },

  goToLine: (fileId: string, line: number) => {
    const { openFiles } = get();
    const newOpenFiles = openFiles.includes(fileId)
      ? openFiles
      : [...openFiles, fileId];
    set({ activeFileId: fileId, activeLine: line, openFiles: newOpenFiles });
  },

  updateFileContent: (fileId: string, content: string) => {
    const { files, currentProject } = get();
    const file = files.find((f) => f.id === fileId);
    if (file && file.content !== content) {
      const updatedFile = { ...file, content, updatedAt: Date.now() };

      set({ files: files.map((f) => (f.id === fileId ? updatedFile : f)) });
      schedule(updatedFile);

      if (currentProject) {
        set({
          currentProject: {
            ...currentProject,
            updatedAt: updatedFile.updatedAt,
          },
        });

        const { projects } = get();
        set({
          projects: [
            ...projects.filter((p) => p.id !== currentProject.id),
            { ...currentProject, updatedAt: updatedFile.updatedAt },
          ].sort((a, b) => b.updatedAt - a.updatedAt),
        });
      }
    }
  },

  createFile: async (
    name: string,
    isFolder: boolean,
    parentPath: string,
    content: string = "",
    blob?: Blob,
  ) => {
    const { currentProject, files } = get();
    if (!currentProject) return;

    const cleanName = getFileName(name);
    if (!isValidName(cleanName)) return;

    const path = parentPath
      ? normalizePath(`${parentPath}/${cleanName}`)
      : cleanName;
    if (!isValidProjectFilePath(path)) return;
    if (files.some((f) => f.path === path)) return;

    const newFile: FileNode = {
      id: crypto.randomUUID(),
      projectId: currentProject.id,
      path,
      name: cleanName,
      isFolder,
      content: isFolder ? undefined : content,
      blob: isFolder ? undefined : blob,
      updatedAt: Date.now(),
      isDeleted: false,
      syncStatus:
        currentProject.storageMode === "local" ? "local-only" : "pending",
    };

    if (parentPath && parentPath !== "") {
      // Also Auto-create parent folders if they don't exist
      const parts = parentPath.split("/");
      let currPath = "";
      for (const p of parts) {
        currPath = currPath ? `${currPath}/${p}` : p;
        const existingFolder = files.find((f) => f.path === currPath);
        if (!existingFolder) {
          const newFolder: FileNode = {
            id: crypto.randomUUID(),
            projectId: currentProject.id,
            path: currPath,
            name: getFileName(currPath),
            isFolder: true,
            updatedAt: Date.now(),
            isDeleted: false,
            syncStatus:
              currentProject.storageMode === "local" ? "local-only" : "pending",
          };
          await FileService.saveFile(newFolder);
          set((state) => ({
            files: [...state.files, newFolder],
            expandedSubfolders: {
              ...state.expandedSubfolders,
              [currPath]: true,
            },
          }));
        } else {
          set((state) => ({
            expandedSubfolders: {
              ...state.expandedSubfolders,
              [currPath]: true,
            },
          }));
        }
      }
    }

    await FileService.saveFile(newFile);

    set((state) => ({
      files: [...state.files, newFile],
    }));

    if (!isFolder) {
      await get().setActiveFile(newFile.id);
    }
  },

  deleteFile: async (fileId: string) => {
    const { files, currentProject, openFiles, activeFileId } = get();
    const fileToDelete = files.find((f) => f.id === fileId);
    if (!fileToDelete) return;

    if (currentProject && fileToDelete.path === currentProject.mainFilePath) {
      // Accidental delete of main file prevention
      alert(
        "Cannot delete the main file of the project. Please set another file as main first.",
      );
      return;
    }

    const filesToDelete = fileToDelete.isFolder
      ? files.filter(
          (f) =>
            f.path === fileToDelete.path ||
            isDescendant(f.path, fileToDelete.path),
        )
      : [fileToDelete];

    const toDeleteIds = filesToDelete.map((f) => f.id);
    const newOpenFiles = openFiles.filter((id) => !toDeleteIds.includes(id));
    const newActiveFileId = toDeleteIds.includes(activeFileId!)
      ? newOpenFiles.length > 0
        ? newOpenFiles[newOpenFiles.length - 1]
        : null
      : activeFileId;

    set({
      files: files.filter((f) => !toDeleteIds.includes(f.id)),
      openFiles: newOpenFiles,
      activeFileId: newActiveFileId,
    });

    for (const fId of toDeleteIds) {
      await FileService.deleteFile(fId);
    }
  },

  renameFileNode: async (fileId: string, newName: string) => {
    const { files, currentProject } = get();
    const targetFile = files.find((f) => f.id === fileId);
    if (!targetFile) return;

    const cleanNewName = getFileName(newName);
    if (!isValidName(cleanNewName)) return;

    const currentParentPath = normalizePath(
      targetFile.path.substring(
        0,
        targetFile.path.length - targetFile.name.length - 1,
      ),
    );
    const newPath = currentParentPath
      ? normalizePath(`${currentParentPath}/${cleanNewName}`)
      : cleanNewName;

    if (!isValidProjectFilePath(newPath)) {
      alert("Invalid file path.");
      return;
    }

    if (files.some((f) => f.path === newPath && f.id !== fileId)) {
      alert("A file or folder with this name already exists in this location.");
      return;
    }

    const prefixOld = targetFile.path + "/";
    const prefixNew = newPath + "/";

    const filesToUpdate: FileNode[] = [];
    const updatedFilesState = files.map((f) => {
      let update = undefined;
      if (f.id === fileId) {
        update = {
          ...f,
          name: cleanNewName,
          path: newPath,
          updatedAt: Date.now(),
        };
      } else if (f.path.startsWith(prefixOld)) {
        const newChildPath = prefixNew + f.path.substring(prefixOld.length);
        update = {
          ...f,
          path: newChildPath,
          name: getFileName(newChildPath),
          updatedAt: Date.now(),
        };
      }

      if (update) {
        filesToUpdate.push(update);
        return update;
      }
      return f;
    });

    set({ files: updatedFilesState });

    for (const f of filesToUpdate) {
      await FileService.saveFile(f);
    }

    if (currentProject && targetFile.path === currentProject.mainFilePath) {
      await get().setProjectMainFile(newPath);
    }
  },

  moveFileNode: async (fileId: string, newParentPath: string) => {
    const { files, currentProject } = get();
    const targetFile = files.find((f) => f.id === fileId);
    if (!targetFile) return;

    const newPath = newParentPath
      ? normalizePath(`${newParentPath}/${targetFile.name}`)
      : targetFile.name;

    if (!isValidProjectFilePath(newPath)) {
      alert("Invalid target path.");
      return;
    }

    if (isDescendant(newPath, targetFile.path) || newPath === targetFile.path) {
      return;
    }

    if (files.some((f) => f.path === newPath && f.id !== fileId)) {
      alert(
        "A file or folder with this name already exists in the destination.",
      );
      return;
    }

    const prefixOld = targetFile.path + "/";
    const prefixNew = newPath + "/";

    const filesToUpdate: FileNode[] = [];
    const updatedFilesState = files.map((f) => {
      let update = undefined;
      if (f.id === fileId) {
        update = { ...f, path: newPath, updatedAt: Date.now() };
      } else if (f.path.startsWith(prefixOld)) {
        const newChildPath = prefixNew + f.path.substring(prefixOld.length);
        update = {
          ...f,
          path: newChildPath,
          name: getFileName(newChildPath),
          updatedAt: Date.now(),
        };
      }

      if (update) {
        filesToUpdate.push(update);
        return update;
      }
      return f;
    });

    set({ files: updatedFilesState });

    for (const f of filesToUpdate) {
      await FileService.saveFile(f);
    }

    if (currentProject && targetFile.path === currentProject.mainFilePath) {
      await get().setProjectMainFile(newPath);
    }
  },

  duplicateFileNode: async (fileId: string) => {
    const { files, currentProject } = get();
    if (!currentProject) return;

    const sourceFile = files.find((f) => f.id === fileId);
    if (!sourceFile) return;

    const parentPath = sourceFile.path.substring(
      0,
      sourceFile.path.length - sourceFile.name.length - 1,
    );

    // Find unique name
    let newName = `Copy of ${sourceFile.name}`;
    let copyIndex = 1;
    let newPath = parentPath ? `${parentPath}/${newName}` : newName;
    while (files.some((f) => f.path === newPath)) {
      newName = `Copy (${copyIndex}) of ${sourceFile.name}`;
      newPath = parentPath ? `${parentPath}/${newName}` : newName;
      copyIndex++;
    }

    const filesToCreate: FileNode[] = [];
    const prefixOld = sourceFile.path + "/";
    const prefixNew = newPath + "/";

    const processCopy = (f: FileNode, newChildPath: string) => {
      filesToCreate.push({
        ...f,
        id: crypto.randomUUID(),
        path: newChildPath,
        name: getFileName(newChildPath),
        updatedAt: Date.now(),
        syncStatus:
          currentProject.storageMode === "local" ? "local-only" : "pending",
      });
    };

    processCopy(sourceFile, newPath);

    if (sourceFile.isFolder) {
      const children = files.filter((f) => f.path.startsWith(prefixOld));
      for (const child of children) {
        const newChildPath = prefixNew + child.path.substring(prefixOld.length);
        processCopy(child, newChildPath);
      }
    }

    set((state) => ({ files: [...state.files, ...filesToCreate] }));

    for (const f of filesToCreate) {
      await FileService.saveFile(f);
    }
  },

  toggleFolderExpansion: (path: string, expand?: boolean) => {
    set((state) => {
      const isExpanded =
        expand !== undefined ? expand : !state.expandedSubfolders[path];

      const newExpanded = {
        ...state.expandedSubfolders,
        [path]: isExpanded,
      };

      // Persist to local storage for this project if there's a current project
      if (state.currentProject) {
        try {
          localStorage.setItem(
            `project_${state.currentProject.id}_expand`,
            JSON.stringify(newExpanded),
          );
        } catch {
          // Ignore
        }
      }

      return { expandedSubfolders: newExpanded };
    });
  },

  setCompiling: (isCompiling: boolean) => set({ isCompiling }),
  setCompileResult: (result: CompileResult) => set({ compileResult: result }),
  toggleLogs: () => set((state) => ({ logsVisible: !state.logsVisible })),
}));
