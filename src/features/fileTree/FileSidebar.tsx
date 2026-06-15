import React, { useState, useMemo, useRef, useEffect } from "react";
import { FileNode } from "../../types";
import { useEditorStore } from "../../state/store";
import { FileTreeNode } from "./FileTreeNode";
import { Plus, FolderPlus, Upload } from "lucide-react";
import { isValidName, getFileName } from "../../utils/paths";

interface TreeNodeType {
  path: string;
  name: string;
  isFolder: boolean;
  node?: FileNode;
  children: Record<string, TreeNodeType>;
}

function buildTree(files: FileNode[]): Record<string, TreeNodeType> {
  const root: Record<string, TreeNodeType> = {};

  const ensurePath = (path: string): TreeNodeType => {
    if (!path) return { path: "", name: "", isFolder: true, children: root };

    // Split directly or find parent
    const parts = path.split("/");
    let currentLevel = root;
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!currentLevel[part]) {
        currentLevel[part] = {
          path: currentPath,
          name: part,
          isFolder: true,
          children: {},
        };
      }
      if (i === parts.length - 1) {
        return currentLevel[part];
      }
      currentLevel = currentLevel[part].children;
    }
    throw new Error("Should not reach");
  };

  files.forEach((file) => {
    const node = ensurePath(file.path);
    node.isFolder = file.isFolder;
    node.node = file;
  });

  return root;
}

export function FileSidebar() {
  const {
    files,
    createFile,
    deleteFile,
    renameFileNode,
    duplicateFileNode,
    setProjectMainFile,
    currentProject,
  } = useEditorStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: FileNode | null;
  } | null>(null);

  const tree = useMemo(() => buildTree(files), [files]);

  useEffect(() => {
    const handleContextMenuEvent = (e: Event) => {
      const ce = e as CustomEvent;
      setContextMenu(ce.detail);
    };
    const handleClick = () => setContextMenu(null);
    document.addEventListener("open-context-menu", handleContextMenuEvent);
    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("open-context-menu", handleContextMenuEvent);
      document.removeEventListener("click", handleClick);
    };
  }, []);

  const handleNewFile = () => {
    const name = prompt(
      "Enter file name (e.g., chapter1.tex or content/data.txt):",
    );
    if (name && isValidName(getFileName(name))) {
      createFile(name, false, "");
    }
  };

  const handleNewFolder = () => {
    const name = prompt("Enter folder name:");
    if (name && isValidName(getFileName(name))) {
      createFile(name, true, "");
    }
  };

  const handleNativeDrop = async (e: React.DragEvent) => {
    const parentPath = contextMenu?.node?.isFolder ? contextMenu.node.path : "";
    handleNativeUpload(e.dataTransfer.files, parentPath);
  };

  const handleNativeUpload = async (
    fileList: FileList | null,
    parentPath: string = "",
  ) => {
    if (!fileList || fileList.length === 0) return;
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];

      if (file.size > 20 * 1024 * 1024) {
        // 20MB limit
        alert(`${file.name} is too large (> 20MB)`);
        continue;
      }

      const reader = new FileReader();

      const isText =
        file.type.startsWith("text/") ||
        file.name.match(/\.(tex|bib|cls|sty|txt|md|csv|json)$/i);

      if (isText) {
        reader.onload = async (e) => {
          const content = e.target?.result as string;
          await createFile(file.name, false, parentPath, content);
        };
        reader.readAsText(file);
      } else {
        reader.onload = async (e) => {
          const buffer = e.target?.result as ArrayBuffer;
          const blob = new Blob([buffer], { type: file.type });
          await createFile(file.name, false, parentPath, undefined, blob);
        };
        reader.readAsArrayBuffer(file);
      }
    }
  };

  return (
    <div className="w-full h-full bg-zinc-900 border-r border-zinc-800 flex flex-col pt-2 text-zinc-300 relative">
      <div className="px-4 flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          Files
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleNewFile}
            className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200"
            title="New File"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleNewFolder}
            className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200"
            title="New Folder"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200"
            title="Upload File"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <input
        type="file"
        multiple
        className="hidden"
        ref={fileInputRef}
        onChange={(e) => handleNativeUpload(e.target.files)}
      />

      <div
        className="flex-1 overflow-y-auto w-full pb-4"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length > 0) {
            handleNativeDrop(e);
          }
        }}
      >
        {Object.values(tree)
          .sort((a, b) => {
            if (a.isFolder === b.isFolder) return a.name.localeCompare(b.name);
            return a.isFolder ? -1 : 1;
          })
          .map((node) => (
            <FileTreeNode key={node.path} treeNode={node} level={0} />
          ))}

        {files.length === 0 && (
          <div className="px-4 text-zinc-500 text-xs italic mt-4 text-center border-2 border-dashed border-zinc-700 p-4 m-4 rounded">
            Drag and drop files here
          </div>
        )}
      </div>

      {contextMenu && contextMenu.node && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 bg-zinc-800 border border-zinc-700 shadow-xl rounded py-1 min-w-[160px] text-sm text-zinc-300"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-4 py-1.5 hover:bg-zinc-700"
            onClick={() => {
              const newName = prompt("Rename to:", contextMenu.node!.name);
              if (newName && newName !== contextMenu.node!.name)
                renameFileNode(contextMenu.node!.id, newName);
              setContextMenu(null);
            }}
          >
            Rename
          </button>

          {!contextMenu.node.isFolder && (
            <button
              className="w-full text-left px-4 py-1.5 hover:bg-zinc-700"
              onClick={() => {
                duplicateFileNode(contextMenu.node!.id);
                setContextMenu(null);
              }}
            >
              Duplicate
            </button>
          )}

          {!contextMenu.node.isFolder &&
            contextMenu.node.path.endsWith(".tex") &&
            currentProject?.mainFilePath !== contextMenu.node.path && (
              <button
                className="w-full text-left px-4 py-1.5 hover:bg-zinc-700"
                onClick={() => {
                  setProjectMainFile(contextMenu.node!.path);
                  setContextMenu(null);
                }}
              >
                Set as Main File
              </button>
            )}

          <div className="border-t border-zinc-700 my-1"></div>

          <button
            className="w-full text-left px-4 py-1.5 hover:bg-red-900/50 text-red-400"
            onClick={() => {
              if (
                contextMenu.node?.isFolder &&
                !confirm(
                  `Delete folder '${contextMenu.node.name}' and all contents?`,
                )
              )
                return;
              deleteFile(contextMenu.node!.id);
              setContextMenu(null);
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
