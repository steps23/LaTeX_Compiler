import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ExternalLink,
  Loader2,
  RefreshCw,
  TerminalSquare,
} from "lucide-react";
import {
  detectTexRuntimes,
  getTexRuntimeSelection,
  resolveEffectiveTexRuntimeId,
  saveTexRuntimeSelection,
  TexRuntime,
  TexRuntimeDiagnostic,
  TexRuntimeSelection,
} from "../../utils/texRuntime";
import { useEditorStore } from "../../state/store";

const docs = [
  ["TeX Live", "https://tug.org/texlive/"],
  ["MacTeX", "https://tug.org/mactex/"],
  ["MiKTeX", "https://miktex.org/"],
  ["latexmk", "https://ctan.org/pkg/latexmk"],
];

export function TexEnvironment() {
  const { currentProject, loadInitialState, setProjectTexRuntime } =
    useEditorStore();
  const [diagnostic, setDiagnostic] = useState<TexRuntimeDiagnostic | null>(
    null,
  );
  const [selection, setSelection] = useState<TexRuntimeSelection | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingRuntimeId, setSavingRuntimeId] = useState<string | null>(null);
  const [savingProjectRuntimeId, setSavingProjectRuntimeId] = useState<
    string | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [runtimeDiagnostic, runtimeSelection] = await Promise.all([
        detectTexRuntimes(),
        getTexRuntimeSelection(),
      ]);
      setDiagnostic(runtimeDiagnostic);
      setSelection(runtimeSelection);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const selectRuntime = async (runtime: TexRuntime | null) => {
    setSavingRuntimeId(runtime?.id ?? "__clear__");
    setError(null);
    try {
      setSelection(await saveTexRuntimeSelection(runtime));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingRuntimeId(null);
    }
  };

  const selectProjectRuntime = async (
    runtime: TexRuntime | null | undefined,
  ) => {
    setSavingProjectRuntimeId(
      runtime === undefined
        ? "__project_inherit__"
        : (runtime?.id ?? "__project_disable__"),
    );
    setError(null);
    try {
      await setProjectTexRuntime(
        runtime === undefined ? undefined : (runtime?.id ?? null),
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingProjectRuntimeId(null);
    }
  };

  useEffect(() => {
    let active = true;

    const detectInitial = async () => {
      try {
        const [runtimeDiagnostic, runtimeSelection] = await Promise.all([
          detectTexRuntimes(),
          getTexRuntimeSelection(),
        ]);
        if (active) {
          setDiagnostic(runtimeDiagnostic);
          setSelection(runtimeSelection);
        }
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadInitialState();
    void detectInitial();

    return () => {
      active = false;
    };
  }, [loadInitialState]);

  const hasRuntime = (diagnostic?.runtimes.length ?? 0) > 0;
  const effectiveRuntimeId = resolveEffectiveTexRuntimeId(
    currentProject,
    selection,
  );
  const selectedRuntime = diagnostic?.runtimes.find(
    (runtime) => runtime.id === selection?.selectedRuntimeId,
  );
  const projectRuntime = diagnostic?.runtimes.find(
    (runtime) => runtime.id === currentProject?.settings.texRuntimeId,
  );
  const effectiveRuntime = diagnostic?.runtimes.find(
    (runtime) => runtime.id === effectiveRuntimeId,
  );

  return (
    <div className="w-screen h-screen bg-zinc-950 text-zinc-200 flex flex-col font-sans overflow-hidden">
      <header className="h-16 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            to="/projects"
            className="text-zinc-400 hover:text-white bg-zinc-800/70 hover:bg-zinc-800 px-2 py-1.5 rounded-md"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <TerminalSquare className="w-6 h-6 text-emerald-400" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              LaTeX Environment
            </h1>
            <p className="text-xs text-zinc-500">
              Local TeX runtime detection. No shell. No installation changes.
            </p>
          </div>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-60 text-white px-4 py-2 rounded-md font-medium flex items-center gap-2 border border-zinc-700"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Detect
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-6 lg:p-10">
        <div className="max-w-5xl mx-auto space-y-6">
          {error && (
            <section className="bg-red-950/40 border border-red-900 text-red-200 rounded-lg p-4">
              {error}
            </section>
          )}

          <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Detection status
                </h2>
                <p className="text-sm text-zinc-400 mt-1">
                  Host: {diagnostic?.hostOs ?? "detecting"} /{" "}
                  {diagnostic?.hostArch ?? "detecting"}
                </p>
                <p className="text-sm text-zinc-400 mt-1">
                  Global runtime: {selectedRuntime?.distribution ?? "none"}
                  {selection?.selectedBinDir
                    ? ` · ${selection.selectedBinDir}`
                    : ""}
                </p>
                <p className="text-sm text-zinc-400 mt-1">
                  Project runtime: {currentProject?.name ?? "no project open"} ·{" "}
                  {projectRuntime?.distribution ??
                    (currentProject?.settings.texRuntimeId === null
                      ? "disabled"
                      : "inherits global")}
                </p>
                <p className="text-sm text-zinc-400 mt-1">
                  Effective runtime: {effectiveRuntime?.distribution ?? "none"}
                </p>
              </div>
              <div
                className={`flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-full ${
                  hasRuntime
                    ? "text-emerald-300 bg-emerald-500/10"
                    : "text-amber-300 bg-amber-500/10"
                }`}
              >
                {hasRuntime ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                {hasRuntime ? "Runtime detected" : "No runtime detected"}
              </div>
            </div>

            {diagnostic?.missingCoreTools.length ? (
              <div className="mt-4 text-sm text-amber-200 bg-amber-500/10 border border-amber-900/60 rounded-md p-3">
                Missing core tools: {diagnostic.missingCoreTools.join(", ")}
              </div>
            ) : null}

            {selection?.selectedRuntimeId && !selectedRuntime ? (
              <div className="mt-4 text-sm text-amber-200 bg-amber-500/10 border border-amber-900/60 rounded-md p-3">
                Saved global runtime is no longer detected. Choose a detected
                runtime or clear the selection.
              </div>
            ) : null}

            {currentProject?.settings.texRuntimeId && !projectRuntime ? (
              <div className="mt-4 text-sm text-amber-200 bg-amber-500/10 border border-amber-900/60 rounded-md p-3">
                Saved project runtime is no longer detected. Choose a detected
                runtime for this project or clear the project override.
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              {selection?.selectedRuntimeId ? (
                <button
                  onClick={() => void selectRuntime(null)}
                  disabled={savingRuntimeId === "__clear__"}
                  className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-60 text-zinc-200 px-3 py-1.5 rounded-md text-sm border border-zinc-700"
                >
                  {savingRuntimeId === "__clear__"
                    ? "Clearing…"
                    : "Clear global selection"}
                </button>
              ) : null}
              {currentProject ? (
                <button
                  onClick={() => void selectProjectRuntime(null)}
                  disabled={savingProjectRuntimeId === "__project_disable__"}
                  className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-60 text-zinc-200 px-3 py-1.5 rounded-md text-sm border border-zinc-700"
                >
                  {savingProjectRuntimeId === "__project_disable__"
                    ? "Saving…"
                    : "Disable runtime for project"}
                </button>
              ) : null}
              {currentProject?.settings.texRuntimeId !== undefined ? (
                <button
                  onClick={() => void selectProjectRuntime(undefined)}
                  disabled={savingProjectRuntimeId === "__project_inherit__"}
                  className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-60 text-zinc-200 px-3 py-1.5 rounded-md text-sm border border-zinc-700"
                >
                  {savingProjectRuntimeId === "__project_inherit__"
                    ? "Saving…"
                    : "Inherit global runtime"}
                </button>
              ) : null}
            </div>
          </section>

          {loading ? (
            <div className="flex items-center gap-3 text-zinc-500 p-8 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" /> Detecting runtimes…
            </div>
          ) : diagnostic?.runtimes.length ? (
            <div className="space-y-4">
              {diagnostic.runtimes.map((runtime) => (
                <section
                  key={runtime.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg p-5"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div>
                      <h3 className="text-white font-semibold">
                        {runtime.distribution} · {runtime.status}
                      </h3>
                      <p className="text-sm text-zinc-500 mt-1 break-all">
                        {runtime.binDir}
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        Source: {runtime.detectionSource} · Package manager:{" "}
                        {runtime.packageManager}
                      </p>
                    </div>
                    <div className="flex flex-col items-start md:items-end gap-2">
                      <div className="text-xs text-zinc-400 bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2">
                        PDF: {runtime.capabilities.canCompilePdf ? "yes" : "no"}
                        <br />
                        Bib:{" "}
                        {runtime.capabilities.hasBibliography ? "yes" : "no"}
                        <br />
                        SyncTeX:{" "}
                        {runtime.capabilities.hasSynctex ? "yes" : "no"}
                      </div>
                      <button
                        onClick={() => void selectRuntime(runtime)}
                        disabled={savingRuntimeId !== null}
                        className={`px-3 py-1.5 rounded-md text-sm border disabled:opacity-60 ${
                          selection?.selectedRuntimeId === runtime.id
                            ? "bg-emerald-500/10 text-emerald-300 border-emerald-900/60"
                            : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700"
                        }`}
                      >
                        {selection?.selectedRuntimeId === runtime.id
                          ? "Global selected"
                          : savingRuntimeId === runtime.id
                            ? "Saving…"
                            : "Use globally"}
                      </button>
                      {currentProject ? (
                        <button
                          onClick={() => void selectProjectRuntime(runtime)}
                          disabled={savingProjectRuntimeId !== null}
                          className={`px-3 py-1.5 rounded-md text-sm border disabled:opacity-60 ${
                            currentProject.settings.texRuntimeId === runtime.id
                              ? "bg-sky-500/10 text-sky-300 border-sky-900/60"
                              : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700"
                          }`}
                        >
                          {currentProject.settings.texRuntimeId === runtime.id
                            ? "Project selected"
                            : savingProjectRuntimeId === runtime.id
                              ? "Saving…"
                              : "Use for project"}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {runtime.tools.map((tool) => (
                      <div
                        key={`${runtime.id}-${tool.name}`}
                        className="bg-zinc-950 border border-zinc-800 rounded-md p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-sm text-zinc-100">
                            {tool.name}
                          </span>
                          <span
                            className={`text-[10px] uppercase tracking-wide ${
                              tool.status === "available"
                                ? "text-emerald-400"
                                : "text-amber-400"
                            }`}
                          >
                            {tool.status}
                          </span>
                        </div>
                        <p
                          className="text-xs text-zinc-500 mt-1 truncate"
                          title={tool.path}
                        >
                          {tool.path}
                        </p>
                        {tool.version && (
                          <p className="text-xs text-zinc-400 mt-2 line-clamp-2">
                            {tool.version}
                          </p>
                        )}
                        {tool.diagnostic && (
                          <p className="text-xs text-amber-300 mt-2">
                            {tool.diagnostic}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <section className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-6 text-zinc-400">
              Install or expose a supported LaTeX distribution to the desktop
              process PATH. Recommended complete distributions: TeX Live,
              MacTeX, or MiKTeX.
            </section>
          )}

          <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <h2 className="text-lg font-semibold text-white mb-3">
              Official documentation
            </h2>
            <div className="grid sm:grid-cols-2 gap-2">
              {docs.map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-300 hover:text-white hover:border-zinc-700"
                >
                  {label}
                  <ExternalLink className="w-4 h-4" />
                </a>
              ))}
            </div>
          </section>

          {diagnostic?.notes.length ? (
            <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
              <h2 className="text-lg font-semibold text-white mb-3">Notes</h2>
              <ul className="list-disc pl-5 text-sm text-zinc-400 space-y-1">
                {diagnostic.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}
