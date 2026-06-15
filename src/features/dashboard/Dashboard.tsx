import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  MoreVertical,
  Trash2,
  FileEdit,
  Copy,
  FolderOpen,
  Clock,
  File as FileIcon,
} from "lucide-react";
import { useEditorStore } from "../../state/store";
import {
  ProjectService,
  ProjectWithStats,
} from "../../services/ProjectService";
import { clsx } from "clsx";

export function Dashboard() {
  const navigate = useNavigate();
  const {
    currentProject,
    deleteProject,
    duplicateProject,
    createEmptyProject,
  } = useEditorStore();

  const [projects, setProjects] = useState<ProjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<
    "updatedAt" | "createdAt" | "name"
  >("updatedAt");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "local-only" | "synced"
  >("all");

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<string | null>(
    null,
  );

  const loadProjects = async () => {
    setLoading(true);
    try {
      const result = await ProjectService.getAllProjectsWithStats();
      setProjects(result);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadProjects();
  }, [currentProject]); // Reload when back from an editor or duplicate happens inside

  const filteredProjects = useMemo(() => {
    return projects
      .filter((p) => !p.isDeleted)
      .filter(
        (p) =>
          search === "" || p.name.toLowerCase().includes(search.toLowerCase()),
      )
      .filter((p) => statusFilter === "all" || p.syncStatus === statusFilter)
      .sort((a, b) => {
        if (sortField === "name") {
          return a.name.localeCompare(b.name);
        } else {
          return b[sortField] - a[sortField];
        }
      });
  }, [projects, search, sortField, statusFilter]);

  const handleDelete = async (id: string) => {
    await deleteProject(id);
    setIsDeleteModalOpen(null);
    const result = await ProjectService.getAllProjectsWithStats();
    setProjects(result);
  };

  const handleDuplicate = async (id: string) => {
    await duplicateProject(id);
    const result = await ProjectService.getAllProjectsWithStats();
    setProjects(result);
  };

  const handleOpen = (id: string) => {
    navigate(`/projects/${id}`);
  };

  return (
    <div className="w-screen h-screen bg-zinc-950 text-zinc-200 flex flex-col font-sans overflow-hidden">
      <header className="h-16 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-600 rounded-sm flex items-center justify-center text-lg font-bold text-white">
            tf
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            TeXForge
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {currentProject && (
            <button
              onClick={() => navigate(`/projects/${currentProject.id}`)}
              className="text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Return to "{currentProject.name}"
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 lg:p-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <h2 className="text-2xl font-semibold text-white">Projects</h2>
            <div className="flex gap-2">
              <input
                type="file"
                accept=".zip"
                className="hidden"
                id="import-zip"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    try {
                      const importProjectZip = (
                        await import("../../utils/projects")
                      ).importProjectZip;
                      const targetId = await importProjectZip(file);
                      navigate(`/projects/${targetId}`);
                    } catch {
                      alert("Failed to import ZIP");
                    }
                  }
                  e.target.value = "";
                }}
              />
              <label
                htmlFor="import-zip"
                className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-md font-medium flex items-center gap-2 transition-colors cursor-pointer border border-zinc-700"
              >
                <FolderOpen className="w-4 h-4" />
                Import
              </label>
              <button
                onClick={() => setIsNewModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-md font-medium flex items-center gap-2 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                New Project
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 bg-zinc-900 p-3 rounded-lg border border-zinc-800">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search projects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-md py-1.5 pl-9 pr-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={sortField}
                onChange={(e) =>
                  setSortField(
                    e.target.value as "updatedAt" | "createdAt" | "name",
                  )
                }
                className="bg-zinc-950 border border-zinc-800 rounded-md py-1.5 px-3 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500"
              >
                <option value="updatedAt">Last Modified</option>
                <option value="createdAt">Date Created</option>
                <option value="name">Name</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value as "all" | "local-only" | "synced",
                  )
                }
                className="bg-zinc-950 border border-zinc-800 rounded-md py-1.5 px-3 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500"
              >
                <option value="all">All Status</option>
                <option value="local-only">Local Only</option>
              </select>

              <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-md ml-2">
                <button
                  onClick={() => setViewMode("grid")}
                  className={clsx(
                    "p-1.5 rounded-l-sm transition-colors",
                    viewMode === "grid"
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-500 hover:text-zinc-300",
                  )}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={clsx(
                    "p-1.5 rounded-r-sm transition-colors",
                    viewMode === "list"
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-500 hover:text-zinc-300",
                  )}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-zinc-500 flex justify-center p-10">
              Loading projects...
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="text-center py-20 bg-zinc-900/50 border border-zinc-800/50 rounded-lg border-dashed">
              <FolderOpen className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-zinc-300 mb-2">
                No projects found
              </h3>
              <p className="text-zinc-500 text-sm max-w-sm mx-auto mb-6">
                {search || statusFilter !== "all"
                  ? "Try adjusting your filters and search query."
                  : "Create your first LaTeX project to get started."}
              </p>
              {!(search || statusFilter !== "all") && (
                <button
                  onClick={() => setIsNewModalOpen(true)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors"
                >
                  Create Project
                </button>
              )}
            </div>
          ) : (
            <div
              className={clsx(
                viewMode === "grid"
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
                  : "flex flex-col gap-3",
              )}
            >
              {filteredProjects.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  viewMode={viewMode}
                  onOpen={() => handleOpen(p.id)}
                  onDuplicate={() => handleDuplicate(p.id)}
                  onDelete={() => setIsDeleteModalOpen(p.id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {isNewModalOpen && (
        <CreateProjectModal
          onClose={() => setIsNewModalOpen(false)}
          onCreate={async (name, template, mainFile) => {
            const id = await createEmptyProject(name, template, mainFile);
            setIsNewModalOpen(false);
            navigate(`/projects/${id}`);
          }}
        />
      )}

      {isDeleteModalOpen && (
        <ConfirmDeleteModal
          onClose={() => setIsDeleteModalOpen(null)}
          onConfirm={() => handleDelete(isDeleteModalOpen)}
        />
      )}
    </div>
  );
}

function ProjectCard({
  project,
  viewMode,
  onOpen,
  onDuplicate,
  onDelete,
}: {
  project: ProjectWithStats;
  viewMode: "grid" | "list";
  onOpen: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const timeStr = new Date(project.updatedAt).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (viewMode === "list") {
    return (
      <div className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg p-3 flex border-l-4 border-l-emerald-600 items-center justify-between transition-all group">
        <div
          className="flex items-center gap-4 flex-1 cursor-pointer"
          onClick={onOpen}
        >
          <div className="w-10 h-10 bg-zinc-950 rounded flex items-center justify-center text-zinc-500">
            <FileIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-zinc-200 group-hover:text-emerald-400 transition-colors">
              {project.name}
            </h3>
            <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> {timeStr}
              </span>
              <span className="flex items-center gap-1">
                <FolderOpen className="w-3 h-3" /> {project.fileCount}{" "}
                {project.fileCount === 1 ? "file" : "files"}
              </span>
              {project.syncStatus === "local-only" && (
                <span className="bg-zinc-700/50 text-zinc-400 px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide shadow-sm">
                  LOCAL
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700/50 rounded-md transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-1 w-40 bg-zinc-800 border border-zinc-700 rounded-md shadow-xl z-10 py-1"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onOpen();
                }}
                className="w-full text-left px-4 py-2 hover:bg-zinc-700 text-sm text-zinc-200 flex items-center gap-2"
              >
                <FileEdit className="w-4 h-4 text-zinc-400" /> Open
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onDuplicate();
                }}
                className="w-full text-left px-4 py-2 hover:bg-zinc-700 text-sm text-zinc-200 flex items-center gap-2"
              >
                <Copy className="w-4 h-4 text-zinc-400" /> Duplicate
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onDelete();
                }}
                className="w-full text-left px-4 py-2 hover:bg-red-500/20 text-sm text-red-400 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-lg p-5 flex flex-col transition-all group overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-600 to-teal-800 opacity-50 group-hover:opacity-100 transition-opacity" />

      <div className="flex items-start justify-between mb-4 mt-2">
        <div
          className="bg-zinc-950 p-2.5 rounded-md border border-zinc-800 text-zinc-400 group-hover:text-emerald-400 transition-colors cursor-pointer"
          onClick={onOpen}
        >
          <FileIcon className="w-6 h-6" />
        </div>
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700/50 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-1 w-40 bg-zinc-800 border border-zinc-700 rounded-md shadow-xl z-10 py-1"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onOpen();
                }}
                className="w-full text-left px-4 py-2 hover:bg-zinc-700 text-sm text-zinc-200 flex items-center gap-2"
              >
                <FileEdit className="w-4 h-4 text-zinc-400" /> Open
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onDuplicate();
                }}
                className="w-full text-left px-4 py-2 hover:bg-zinc-700 text-sm text-zinc-200 flex items-center gap-2"
              >
                <Copy className="w-4 h-4 text-zinc-400" /> Duplicate
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onDelete();
                }}
                className="w-full text-left px-4 py-2 hover:bg-red-500/20 text-sm text-red-400 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <h3
        className="font-semibold text-zinc-100 text-lg mb-1 truncate cursor-pointer"
        onClick={onOpen}
      >
        {project.name}
      </h3>

      <div className="flex items-center gap-2 mb-4">
        {project.syncStatus === "local-only" && (
          <span className="bg-zinc-800 text-emerald-400/80 px-2 py-0.5 rounded text-xs font-semibold tracking-wide border border-emerald-900/30">
            Local
          </span>
        )}
      </div>

      <div className="mt-auto pt-4 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" /> {timeStr}
        </span>
        <span className="flex items-center gap-1.5">
          <FolderOpen className="w-3.5 h-3.5" /> {project.fileCount}
        </span>
      </div>
    </div>
  );
}

function CreateProjectModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (
    name: string,
    template: "empty" | "article" | "report",
    mainFile: string,
  ) => void;
}) {
  const [name, setName] = useState("");
  const [template, setTemplate] = useState<"empty" | "article" | "report">(
    "article",
  );
  const [mainPath, setMainPath] = useState("main.tex");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), template, mainPath.trim() || "main.tex");
  };

  return (
    <div className="fixed top-0 left-0 w-full h-full bg-black/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
          <h3 className="text-lg font-semibold text-white">
            Create New Project
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">
              Project Name
            </label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-md py-2 px-3 text-white focus:outline-none focus:border-emerald-500"
              placeholder="e.g. Thesis Draft"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">
              Template
            </label>
            <select
              value={template}
              onChange={(e) =>
                setTemplate(e.target.value as "empty" | "article" | "report")
              }
              className="w-full bg-zinc-950 border border-zinc-700 rounded-md py-2 px-3 text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="empty">Empty Project</option>
              <option value="article">Standard Article</option>
              <option value="report">Standard Report</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">
              Main File Name
            </label>
            <input
              type="text"
              value={mainPath}
              onChange={(e) => setMainPath(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-md py-2 px-3 text-white focus:outline-none focus:border-emerald-500"
              placeholder="main.tex"
            />
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md font-medium text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors shadow-sm"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed top-0 left-0 w-full h-full bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-6 max-w-sm w-full animate-in fade-in zoom-in-95 duration-200 text-center">
        <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-6 h-6" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">
          Delete Project?
        </h3>
        <p className="text-zinc-400 text-sm mb-6">
          This action is irreversible. All associated files and local data will
          be permanently deleted.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-md font-medium text-sm text-zinc-300 hover:bg-zinc-800 border border-zinc-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-500 text-white px-5 py-2 rounded-md font-medium text-sm transition-colors shadow-sm"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
