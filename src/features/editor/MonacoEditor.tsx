import { useRef, useEffect, useState, useCallback } from "react";
import { useEditorStore } from "../../state/store";
import { X, File } from "lucide-react";
import Editor, { OnMount, loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
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

function BlobViewer({ blob, name }: { blob: Blob; name: string }) {
  const imgRef = useRef<HTMLImageElement>(null);

  const isImage = name.match(/\.(png|jpg|jpeg|svg|gif|webp)$/i);

  useEffect(() => {
    if (!isImage) return;

    const url = URL.createObjectURL(blob);
    if (imgRef.current) {
      imgRef.current.src = url;
    }

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [blob, isImage]);

  if (isImage) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-zinc-950/50">
        <img
          ref={imgRef}
          alt={name}
          className="max-w-full max-h-full object-contain drop-shadow-xl"
        />
        <div className="mt-4 text-zinc-500 font-mono text-xs">
          {name} • {(blob.size / 1024).toFixed(1)} KB
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-zinc-950/50">
      <File className="w-16 h-16 text-zinc-600 mb-4" />
      <div className="text-zinc-300 font-medium mb-1">{name}</div>
      <div className="text-zinc-500 text-sm">
        Binary file preview not supported.
      </div>
      <div className="mt-4 text-zinc-500 font-mono text-xs">
        {(blob.size / 1024).toFixed(1)} KB
      </div>
    </div>
  );
}

export function MonacoEditorRenderer() {
  const {
    files,
    activeFileId,
    activeLine,
    updateFileContent,
    openFiles,
    setActiveFile,
    closeFileAndTab,
  } = useEditorStore();
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const disposablesRef = useRef<{ dispose: () => void }[]>([]);

  const activeFile = files.find((f) => f.id === activeFileId);
  const openFileNodes = openFiles
    .map((id) => files.find((f) => f.id === id))
    .filter(Boolean) as FileNode[];

  // 1. Stable, consistent state capturing
  const saveCurrentViewState = useCallback(() => {
    if (!editorRef.current) return;
    const currentId = useEditorStore.getState().activeFileId;
    if (currentId) {
      useEditorStore
        .getState()
        .setEditorViewState(
          currentId,
          editorRef.current.saveViewState() || null,
        );
    }
  }, []);

  // Synchronously capture view state right when `activeFileId` changes, before React renders
  useEffect(() => {
    const unsubscribe = useEditorStore.subscribe((state, prevState) => {
      if (
        prevState.activeFileId &&
        state.activeFileId !== prevState.activeFileId &&
        editorRef.current
      ) {
        useEditorStore
          .getState()
          .setEditorViewState(
            prevState.activeFileId,
            editorRef.current.saveViewState() || null,
          );
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (editorRef.current && activeLine) {
      editorRef.current.revealLineInCenter(activeLine);
      editorRef.current.setPosition({ lineNumber: activeLine, column: 1 });
      editorRef.current.focus();
    }
  }, [activeLine, activeFileId]);

  useEffect(() => {
    return () => {
      disposablesRef.current.forEach((d) => d.dispose());
      disposablesRef.current = [];
    };
  }, []);

  const handleEditorMount: OnMount = useCallback(
    (editor) => {
      const monacoEditor = editor as monaco.editor.IStandaloneCodeEditor;
      editorRef.current = monacoEditor;

      disposablesRef.current.forEach((d) => d.dispose());
      disposablesRef.current = [];

      // When the actual model (file) changes inside Monaco, we restore its specific state
      disposablesRef.current.push(
        monacoEditor.onDidChangeModel((e) => {
          const currentId = useEditorStore.getState().activeFileId;
          if (currentId) {
            const state = useEditorStore.getState().editorViewStates[currentId];
            if (state) {
              monacoEditor.restoreViewState(state);
            } else {
              monacoEditor.setScrollTop(0);
              monacoEditor.setPosition({ lineNumber: 1, column: 1 });
            }
          }
        }),
      );

      const currentId = useEditorStore.getState().activeFileId;
      if (currentId) {
        const state = useEditorStore.getState().editorViewStates[currentId];
        if (state) {
          monacoEditor.restoreViewState(state);
        }
      }

      if (useEditorStore.getState().activeLine) {
        monacoEditor.revealLineInCenter(useEditorStore.getState().activeLine!);
        monacoEditor.setPosition({
          lineNumber: useEditorStore.getState().activeLine!,
          column: 1,
        });
        monacoEditor.focus();
      }

      disposablesRef.current.push(
        monacoEditor.onDidChangeCursorPosition(saveCurrentViewState),
      );
      disposablesRef.current.push(
        monacoEditor.onDidScrollChange(saveCurrentViewState),
      );
    },
    [saveCurrentViewState],
  );

  const renderContent = () => {
    if (!activeFile) return null;

    if (activeFile.blob) {
      return (
        <BlobViewer
          key={`${activeFile.id}-${activeFile.updatedAt}`}
          blob={activeFile.blob}
          name={activeFile.name}
        />
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
