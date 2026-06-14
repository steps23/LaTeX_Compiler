import { create } from 'zustand';
import { Project, FileNode, CompileResult } from '../types';
import * as db from './db';

export interface EditorState {
  // Global View
  currentProject: Project | null;
  projects: Project[];
  
  // Project State
  files: FileNode[];
  activeFileId: string | null;
  activeLine: number | null;
  isCompiling: boolean;
  compileResult: CompileResult | null;
  logsVisible: boolean;
  
  // Actions
  loadInitialState: () => Promise<void>;
  createExampleProject: () => Promise<void>;
  openProject: (projectId: string) => Promise<void>;
  closeProject: () => void;
  deleteProject: (projectId: string) => Promise<void>;
  
  // File Actions
  setActiveFile: (fileId: string) => void;
  goToLine: (fileId: string, line: number) => void;
  updateFileContent: (fileId: string, content: string) => void;
  createFile: (name: string, isFolder: boolean, content?: string) => Promise<void>;
  deleteFile: (fileId: string) => Promise<void>;
  
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
  activeLine: null,
  isCompiling: false,
  compileResult: null,
  logsVisible: false,

  loadInitialState: async () => {
    const projects = await db.loadProjects();
    set({ projects: projects.reverse() });
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
      settings: {
        compiler: "http-fallback",
        autoCompile: false,
        autoCompileDelayMs: 2000,
        fontSize: 14,
      }
    };

    const mainFile: FileNode = {
      id: crypto.randomUUID(),
      projectId,
      path: "main.tex",
      name: "main.tex",
      isFolder: false,
      updatedAt: now,
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

\\end{document}`
    };

    const bibFile: FileNode = {
      id: crypto.randomUUID(),
      projectId,
      path: "references.bib",
      name: "references.bib",
      isFolder: false,
      updatedAt: now,
      content: `@article{example,
  title={An Example Reference},
  author={Doe, John},
  journal={Journal of TeX},
  year={2026}
}`
    };

    await db.saveProject(project);
    await db.saveFileNode(mainFile);
    await db.saveFileNode(bibFile);
    
    const projects = await db.loadProjects();
    set({ projects: projects.reverse() });
    
    await get().openProject(projectId);
  },

  openProject: async (projectId: string) => {
    const project = await db.loadProject(projectId);
    if (!project) return;
    
    const files = await db.loadFiles(projectId);
    const mainFile = files.find(f => f.path === project.mainFilePath) || files[0];
    
    set({
      currentProject: project,
      files,
      activeFileId: mainFile?.id || null,
      compileResult: null,
      logsVisible: false
    });
  },

  closeProject: () => {
    set({ currentProject: null, files: [], activeFileId: null, compileResult: null, logsVisible: false });
  },
  
  deleteProject: async (projectId: string) => {
    await db.deleteProjectData(projectId);
    const projects = await db.loadProjects();
    set({ projects: projects.reverse() });
  },

  setActiveFile: (fileId: string) => {
    set({ activeFileId: fileId, activeLine: null });
  },

  goToLine: (fileId: string, line: number) => {
    set({ activeFileId: fileId, activeLine: line });
  },

  updateFileContent: async (fileId: string, content: string) => {
    const { files, currentProject } = get();
    const file = files.find(f => f.id === fileId);
    if (file && file.content !== content) {
      const updatedFile = { ...file, content, updatedAt: Date.now() };
      
      // Optimistic update
      set({ files: files.map(f => f.id === fileId ? updatedFile : f) });
      
      // Save
      await db.saveFileNode(updatedFile);
      if (currentProject) {
        const updatedProject = { ...currentProject, updatedAt: Date.now() };
        await db.saveProject(updatedProject);
      }
    }
  },

  createFile: async (name: string, isFolder: boolean, content: string = "") => {
    const { currentProject, files } = get();
    if (!currentProject) return;
    
    // Simplistic path for now (root level)
    const path = name; 
    if (files.some(f => f.path === path)) return; // Exists
    
    const newFile: FileNode = {
      id: crypto.randomUUID(),
      projectId: currentProject.id,
      path,
      name,
      isFolder,
      content: isFolder ? undefined : content,
      updatedAt: Date.now(),
    };
    
    await db.saveFileNode(newFile);
    set({ files: [...files, newFile], activeFileId: isFolder ? get().activeFileId : newFile.id });
  },
  
  deleteFile: async (fileId: string) => {
    await db.deleteFileNode(fileId);
    const files = get().files.filter(f => f.id !== fileId);
    set({ 
      files,
      activeFileId: get().activeFileId === fileId ? (files[0]?.id || null) : get().activeFileId
    });
  },

  setCompiling: (isCompiling: boolean) => set({ isCompiling }),
  setCompileResult: (result: CompileResult) => set({ compileResult: result }),
  toggleLogs: () => set(state => ({ logsVisible: !state.logsVisible })),
}));
