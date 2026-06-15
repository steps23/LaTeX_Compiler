import React from "react";
import { FileNode } from "../../types";
import {
  File,
  FileText,
  FileCode2,
  Image as ImageIcon,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { useEditorStore } from "../../state/store";

interface TreeNodeType {
  path: string;
  name: string;
  isFolder: boolean;
  node?: FileNode;
  children: Record<string, TreeNodeType>;
}

interface FileTreeNodeProps {
  treeNode: TreeNodeType;
  level: number;
}

export function FileTreeNode({ treeNode, level }: FileTreeNodeProps) {
  const {
    activeFileId,
    setActiveFile,
    expandedSubfolders,
    toggleFolderExpansion,
  } = useEditorStore();

  const isExpanded = expandedSubfolders[treeNode.path] || false;
  const isFileActive = treeNode.node && treeNode.node.id === activeFileId;

  const handleDragStart = (e: React.DragEvent) => {
    if (!treeNode.node) return;
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ type: "move", id: treeNode.node.id }),
    );
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
    if (treeNode.isFolder) {
      e.currentTarget.classList.add("bg-emerald-900/20");
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove("bg-emerald-900/20");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove("bg-emerald-900/20");
    if (!treeNode.isFolder) return;

    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      if (data.type === "move" && data.id) {
        if (treeNode.node && treeNode.node.id === data.id) return;
        useEditorStore.getState().moveFileNode(data.id, treeNode.path);
      }
    } catch {
      // If not our drag payload, could be native file upload. We'll handle it globally or in the container.
    }
  };

  const getIcon = () => {
    if (treeNode.isFolder) {
      return isExpanded ? (
        <FolderOpen className="w-4 h-4 text-emerald-400" />
      ) : (
        <Folder className="w-4 h-4 text-emerald-400" />
      );
    }
    const name = treeNode.name.toLowerCase();
    if (name.endsWith(".tex") || name.endsWith(".cls") || name.endsWith(".sty"))
      return <FileCode2 className="w-4 h-4 text-emerald-500" />;
    if (name.endsWith(".bib"))
      return <FileText className="w-4 h-4 text-blue-400" />;
    if (name.match(/\.(png|jpg|jpeg|svg|pdf)$/i))
      return <ImageIcon className="w-4 h-4 text-purple-400" />;
    return <File className="w-4 h-4 text-zinc-400" />;
  };

  const onClick = () => {
    if (treeNode.isFolder) {
      toggleFolderExpansion(treeNode.path);
    } else if (treeNode.node) {
      setActiveFile(treeNode.node.id);
    }
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (treeNode.node) {
      document.dispatchEvent(
        new CustomEvent("open-context-menu", {
          detail: { x: e.clientX, y: e.clientY, node: treeNode.node },
        }),
      );
    }
  };

  return (
    <div>
      <div
        draggable={!!treeNode.node}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={onClick}
        onContextMenu={onContextMenu}
        style={{ paddingLeft: `${level * 12 + 16}px` }}
        className={`flex items-center gap-1.5 py-1.5 cursor-pointer select-none text-sm group
          ${isFileActive ? "bg-emerald-900/30 text-emerald-100 border-l-2 border-emerald-500 pr-2 pl-[calc(1rem-2px)]" : "hover:bg-zinc-800/50 text-zinc-400 border-l-2 border-transparent pr-4 pl-4"}`}
        title={treeNode.path}
      >
        <span className="w-4 flex justify-center text-zinc-500">
          {treeNode.isFolder ? (
            isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )
          ) : null}
        </span>
        {getIcon()}
        <span className="truncate flex-1">{treeNode.name}</span>

        {/* Action hit area could go here, for now rely on context menu */}
      </div>

      {treeNode.isFolder && isExpanded && (
        <div className="flex flex-col">
          {Object.values(treeNode.children)
            .sort((a, b) => {
              if (a.isFolder === b.isFolder)
                return a.name.localeCompare(b.name);
              return a.isFolder ? -1 : 1;
            })
            .map((child) => (
              <FileTreeNode
                key={child.path}
                treeNode={child}
                level={level + 1}
              />
            ))}
        </div>
      )}
    </div>
  );
}
