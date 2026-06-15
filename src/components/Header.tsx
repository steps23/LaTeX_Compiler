import {
  Play,
  Loader,
  Share2,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  Download,
} from "lucide-react";
import { useEditorStore } from "../state/store";
import { getCompiler } from "../features/compiler";
import { flushProject } from "../services/FileDebouncer";
import { Link } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { exportProjectZip } from "../utils/projects";
import { AuthStatus } from "./AuthStatus";

export function Header() {
  const {
    currentProject,
    files,
    isCompiling,
    setCompiling,
    setCompileResult,
    toggleLogs,
    renameProject,
  } = useEditorStore();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingTitle && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditingTitle]);

  const handleCompile = async () => {
    if (!currentProject || isCompiling) return;

    setCompiling(true);
    try {
      await flushProject(currentProject.id);
      const compiler = await getCompiler();
      const result = await compiler.compile(files, currentProject.mainFilePath);
      setCompileResult(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setCompileResult({
        success: false,
        rawLog: message,
        errors: [{ severity: "error", message: message }],
        warnings: [],
        durationMs: 0,
      });
    } finally {
      setCompiling(false);
    }
  };

  const handleTitleSubmit = () => {
    if (
      editTitleValue.trim() &&
      currentProject &&
      editTitleValue !== currentProject.name
    ) {
      renameProject(currentProject.id, editTitleValue.trim());
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleTitleSubmit();
    } else if (e.key === "Escape") {
      setIsEditingTitle(false);
    }
  };

  const handleExport = async () => {
    if (!currentProject) return;
    const excludeGenerated = window.confirm(
      "Exclude generated files (.aux, .log, .pdf, etc.) from the ZIP?",
    );
    await exportProjectZip(currentProject, files, excludeGenerated);
  };

  return (
    <div className="h-14 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4 text-zinc-300 shadow-sm z-10 shrink-0">
      <div className="flex items-center gap-4">
        <Link
          to="/projects"
          className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors bg-zinc-800/50 hover:bg-zinc-800 px-2 py-1.5 rounded-md"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>

        {isEditingTitle ? (
          <input
            ref={inputRef}
            type="text"
            value={editTitleValue}
            onChange={(e) => setEditTitleValue(e.target.value)}
            onBlur={handleTitleSubmit}
            onKeyDown={handleTitleKeyDown}
            className="bg-zinc-800 border border-zinc-700 text-white px-2 py-1 rounded text-sm font-medium w-48 focus:outline-none focus:border-emerald-500"
          />
        ) : (
          <div
            className="text-sm font-medium text-white hover:bg-zinc-800 px-2 py-1 rounded cursor-text max-w-[200px] truncate"
            onClick={() => {
              setEditTitleValue(currentProject?.name || "");
              setIsEditingTitle(true);
            }}
          >
            {currentProject?.name}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <AuthStatus />
        <div className="w-[1px] h-6 bg-zinc-800 mx-2" />
        {currentProject?.storageMode === "local" && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-sm mr-2">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Local Save
          </div>
        )}
        <button
          onClick={handleExport}
          disabled={!currentProject}
          title="Export Project as ZIP"
          className="text-zinc-400 hover:text-zinc-200 p-1.5 rounded-md hover:bg-zinc-800 transition-colors"
        >
          <Download className="w-4 h-4" />
        </button>
        <button
          onClick={handleCompile}
          disabled={isCompiling || !currentProject}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white px-4 py-1.5 rounded-sm font-medium flex items-center gap-2 transition-colors text-sm"
        >
          {isCompiling ? (
            <Loader className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          Compile
        </button>
        <button
          onClick={toggleLogs}
          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-sm flex items-center gap-2 transition-colors text-sm border border-zinc-700"
        >
          Logs
        </button>
      </div>
    </div>
  );
}
