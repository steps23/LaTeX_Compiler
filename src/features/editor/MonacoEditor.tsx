import { useRef, useEffect, useState } from "react";
import { useEditorStore } from "../../state/store";
import { X, File } from "lucide-react";
import Editor, { OnMount, loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
// @ts-expect-error missing type for worker
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
// @ts-expect-error missing type for worker
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";

import { FileNode } from "../../types";

// Configure Monaco to be completely local
self.MonacoEnvironment = {
  getWorker(_: string, label: string) {
    if (label === "json") {
      return new jsonWorker();
    }
    return new editorWorker();
  },
};
loader.config({ monaco });

export function MonacoEditorRenderer() {
  const {
    files,
    activeFileId,
    activeLine,
    updateFileContent,
    openFiles,
    setActiveFile,
    closeFileAndTab,
    editorViewStates,
    setEditorViewState,
  } = useEditorStore();
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const disposablesRef = useRef<{ dispose: () => void }[]>([]);
  const activeFileIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeFileIdRef.current = activeFileId;
  }, [activeFileId]);

  const activeFile = files.find((f) => f.id === activeFileId);
  const openFileNodes = openFiles
    .map((id) => files.find((f) => f.id === id))
    .filter(Boolean) as FileNode[];

  const [imageViewUrl, setImageViewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (editorRef.current && activeLine) {
      editorRef.current.revealLineInCenter(activeLine);
      editorRef.current.setPosition({ lineNumber: activeLine, column: 1 });
      editorRef.current.focus();
    }
  }, [activeLine, activeFileId]);

  useEffect(() => {
    let currentUrl: string | null = null;
    let isMounted = true;

    Promise.resolve().then(() => {
      if (activeFile && activeFile.blob) {
        currentUrl = URL.createObjectURL(activeFile.blob);
        if (isMounted) {
          setImageViewUrl(currentUrl);
        }
      } else {
        if (isMounted) {
          setImageViewUrl(null);
        }
      }
    });

    return () => {
      isMounted = false;
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [activeFile]);

  useEffect(() => {
    return () => {
      disposablesRef.current.forEach((d) => d.dispose());
      disposablesRef.current = [];
    };
  }, []);

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;

    // Clean up previous listeners if remounting
    disposablesRef.current.forEach((d) => d.dispose());
    disposablesRef.current = [];

    // Restore state
    if (activeFileIdRef.current) {
      const state = editorViewStates[activeFileIdRef.current];
      if (state) {
        editor.restoreViewState(state);
      }
    }

    if (activeLine) {
      editor.revealLineInCenter(activeLine);
      editor.setPosition({ lineNumber: activeLine, column: 1 });
      editor.focus();
    }

    const saveViewState = () => {
      const currentId = activeFileIdRef.current;
      if (currentId) {
        const state = editor.saveViewState();
        setEditorViewState(currentId, state);
      }
    };

    disposablesRef.current.push(
      editor.onDidChangeCursorPosition(saveViewState),
    );
    disposablesRef.current.push(editor.onDidScrollChange(saveViewState));
  };

  // Whenever we switch active files but KEEP the same editor instance,
  // onMount isn't called again. So we need to handle restoring view state purely on activeFileId change.
  useEffect(() => {
    if (editorRef.current && activeFileId) {
      const state = editorViewStates[activeFileId];
      if (state) {
        editorRef.current.restoreViewState(state);
      }
    }
  }, [activeFileId, editorViewStates]);

  if (!activeFile && openFiles.length === 0) {
    return (
      <div className="w-full h-full bg-zinc-950 flex shadow-inner flex-col text-zinc-500 items-center justify-center">
        Select a file to start editing.
      </div>
    );
  }

  const renderContent = () => {
    if (!activeFile) return null;

    if (activeFile.blob) {
      const isImage = activeFile.name.match(/\.(png|jpg|jpeg|svg|gif|webp)$/i);
      if (isImage && imageViewUrl) {
        return (
          <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-zinc-950/50">
            <img
              src={imageViewUrl}
              alt={activeFile.name}
              className="max-w-full max-h-full object-contain drop-shadow-xl"
            />
            <div className="mt-4 text-zinc-500 font-mono text-xs">
              {activeFile.name} • {(activeFile.blob.size / 1024).toFixed(1)} KB
            </div>
          </div>
        );
      }
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-zinc-950/50">
          <File className="w-16 h-16 text-zinc-600 mb-4" />
          <div className="text-zinc-300 font-medium mb-1">
            {activeFile.name}
          </div>
          <div className="text-zinc-500 text-sm">
            Binary file preview not supported.
          </div>
          <div className="mt-4 text-zinc-500 font-mono text-xs">
            {(activeFile.blob.size / 1024).toFixed(1)} KB
          </div>
        </div>
      );
    }

    const language =
      activeFile.name.endsWith(".tex") ||
      activeFile.name.endsWith(".cls") ||
      activeFile.name.endsWith(".sty")
        ? "latex"
        : activeFile.name.endsWith(".bib")
          ? "bibtex"
          : activeFile.name.endsWith(".json")
            ? "json"
            : "plaintext";

    return (
      <Editor
        height="100%"
        language={language}
        value={activeFile.content || ""}
        theme="vs-dark"
        path={activeFile.id}
        onMount={handleEditorMount}
        onChange={(val) => {
          if (val !== undefined) {
            updateFileContent(activeFile.id, val);
          }
        }}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          wordWrap: "on",
          lineNumbersMinChars: 3,
          scrollBeyondLastLine: false,
          padding: { top: 16 },
          fontFamily: "'JetBrains Mono', monospace",
        }}
      />
    );
  };

  return (
    <div className="w-full h-full flex flex-col bg-zinc-950 flex-1 min-w-0">
      <div className="h-10 bg-zinc-900 border-b border-zinc-800 flex items-center overflow-x-auto shrink-0 custom-scrollbar">
        {openFileNodes.map((f) => (
          <div
            key={f.id}
            onClick={() => setActiveFile(f.id)}
            className={`h-full flex items-center gap-2 px-3 border-r border-zinc-800 border-b-2 cursor-pointer select-none text-sm min-w-[120px] max-w-[200px] shrink-0
                    ${f.id === activeFileId ? "bg-zinc-800 border-b-emerald-500 text-emerald-100" : "hover:bg-zinc-800/50 border-b-transparent text-zinc-400"}`}
          >
            <span className="truncate flex-1 tracking-tight">{f.name}</span>
            <div
              onClick={(e) => {
                e.stopPropagation();
                closeFileAndTab(f.id);
              }}
              className={`p-0.5 rounded-md hover:bg-zinc-700 ${f.id === activeFileId ? "text-zinc-300" : "text-zinc-500"}`}
            >
              <X className="w-3.5 h-3.5" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex-1 min-h-0 relative">{renderContent()}</div>
    </div>
  );
}
