import { useEffect, useRef, useState, type MouseEvent } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useEditorStore } from "../../state/store";
import { querySyncTexReverse } from "../../utils/syncTex";
import {
  ZoomIn,
  ZoomOut,
  Download,
  AlertTriangle,
  Loader2,
} from "lucide-react";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

function isPdfCancellationError(err: unknown): boolean {
  if (err && typeof err === "object") {
    const errObj = err as { name?: unknown; message?: unknown };
    return (
      errObj.name === "RenderingCancelledException" ||
      errObj.name === "PromiseCancelledException" ||
      String(errObj.message).includes("RenderingCancelledException") ||
      String(errObj.message).includes("PromiseCancelledException")
    );
  }
  return false;
}

// eslint-disable-next-line react-refresh/only-export-components
export function normalizeUnknownError(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error === null || error === undefined) return fallback;

  try {
    return JSON.stringify(error);
  } catch {
    return fallback;
  }
}

export function PdfViewer() {
  const { compileResult, isCompiling, currentProject, files, goToLine } =
    useEditorStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(1.5);
  const [pageNumber, setPageNumber] = useState(1);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [syncTexStatus, setSyncTexStatus] = useState<string | null>(null);
  const [loadedPdf, setLoadedPdf] = useState<{
    sourceBytes: Uint8Array;
    document: pdfjsLib.PDFDocumentProxy;
  } | null>(null);

  // Synchronous pre-paint derivation to make old PDF instantly invisible when new compile result is received
  const visiblePdfDoc =
    loadedPdf &&
    compileResult?.pdfBytes &&
    loadedPdf.sourceBytes === compileResult.pdfBytes
      ? loadedPdf.document
      : null;
  const visibleTotalPages = visiblePdfDoc ? visiblePdfDoc.numPages : 0;
  const visiblePageNumber = visiblePdfDoc
    ? Math.min(pageNumber, visibleTotalPages || 1)
    : 1;

  // Refs for tracking active tasks and serializing destruction
  const activeResourceRef = useRef<{
    generation: number;
    sourceBytes: Uint8Array;
    loadingTask: pdfjsLib.PDFDocumentLoadingTask;
    document: pdfjsLib.PDFDocumentProxy | null;
  } | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const renderPromiseRef = useRef<Promise<void> | null>(null);
  const destroyPromiseRef = useRef<Promise<void>>(Promise.resolve());

  const loadGenerationRef = useRef(0);
  const isMountedRef = useRef(true);

  // Track component mount state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Fetch / Load PDF Document when bytes change
  useEffect(() => {
    // Increment active generation token
    loadGenerationRef.current += 1;
    const currentGeneration = loadGenerationRef.current;

    const loadDoc = async () => {
      const bytes = compileResult?.pdfBytes;

      // Wait for previous destruction task sequences to realize serial integrity (A -> B -> C)
      await destroyPromiseRef.current;

      if (
        currentGeneration !== loadGenerationRef.current ||
        !isMountedRef.current
      ) {
        return;
      }

      if (!bytes || bytes.length === 0) {
        setLoadedPdf(null);
        return;
      }

      try {
        const workerBytes = bytes.slice();
        const loadingTask = pdfjsLib.getDocument({ data: workerBytes });

        const resource = {
          generation: currentGeneration,
          sourceBytes: bytes,
          loadingTask,
          document: null as pdfjsLib.PDFDocumentProxy | null,
        };

        activeResourceRef.current = resource;

        const doc = await loadingTask.promise;

        if (
          currentGeneration !== loadGenerationRef.current ||
          !isMountedRef.current
        ) {
          return;
        }

        resource.document = doc;
        setLoadedPdf({ sourceBytes: bytes, document: doc });
        setPageNumber(1);
        setRenderError(null);
      } catch (err: unknown) {
        if (
          currentGeneration !== loadGenerationRef.current ||
          !isMountedRef.current
        ) {
          return;
        }

        if (isPdfCancellationError(err)) {
          return;
        }

        console.error("PDF Load Error", err);
        const errMessage = normalizeUnknownError(err, "Unknown loading error");
        setRenderError(errMessage);
      }
    };

    void loadDoc().catch((err) => {
      if (
        currentGeneration === loadGenerationRef.current &&
        isMountedRef.current
      ) {
        console.error("Unexpected loadDoc error", err);
      }
    });

    return () => {
      const currentResource = activeResourceRef.current;
      activeResourceRef.current = null;

      destroyPromiseRef.current = destroyPromiseRef.current.then(async () => {
        // Cancel outstanding render context of old tasks
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {
            // ignore
          }
          renderTaskRef.current = null;
        }
        if (renderPromiseRef.current) {
          try {
            await renderPromiseRef.current;
          } catch {
            // ignore
          }
          renderPromiseRef.current = null;
        }

        // Safe cleanup of the loading task
        if (currentResource?.loadingTask) {
          try {
            await currentResource.loadingTask.destroy();
          } catch (err) {
            if (!isPdfCancellationError(err)) {
              console.error("PDF load task destruction error", err);
            }
          }
        }
      });
    };
  }, [compileResult?.pdfBytes]);

  // Render Page when visiblePdfDoc, scale, or visiblePageNumber changes
  useEffect(() => {
    if (!visiblePdfDoc) {
      // Clear canvas context when document is invalidated
      const canvas = canvasRef.current;
      if (canvas) {
        const context = canvas.getContext("2d");
        if (context && typeof context.clearRect === "function") {
          context.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      return;
    }

    let localRenderTask: pdfjsLib.RenderTask | null = null;
    let cancelled = false;
    const currentLoadGen = loadGenerationRef.current;

    const renderPage = async () => {
      // Cancel previous render task and await its completion to serialize canvas operations
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
        renderTaskRef.current = null;
      }
      if (renderPromiseRef.current) {
        try {
          await renderPromiseRef.current;
        } catch {
          // ignore
        }
        renderPromiseRef.current = null;
      }

      if (
        cancelled ||
        currentLoadGen !== loadGenerationRef.current ||
        !isMountedRef.current
      ) {
        return;
      }

      try {
        const page = await visiblePdfDoc.getPage(visiblePageNumber);

        if (
          cancelled ||
          currentLoadGen !== loadGenerationRef.current ||
          !isMountedRef.current
        ) {
          return;
        }

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        const viewport = page.getViewport({ scale });

        // Support HiDPI-displays
        const outputScale = window.devicePixelRatio || 1;

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = Math.floor(viewport.width) + "px";
        canvas.style.height = Math.floor(viewport.height) + "px";

        const transform =
          outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

        const renderContext = {
          canvasContext: context,
          transform: transform || undefined,
          viewport: viewport,
        } as Parameters<typeof page.render>[0];

        localRenderTask = page.render(renderContext);
        renderTaskRef.current = localRenderTask;
        renderPromiseRef.current = localRenderTask.promise;

        await localRenderTask.promise;

        if (renderTaskRef.current === localRenderTask) {
          renderTaskRef.current = null;
        }
        if (renderPromiseRef.current === localRenderTask.promise) {
          renderPromiseRef.current = null;
        }
      } catch (err: unknown) {
        if (
          cancelled ||
          currentLoadGen !== loadGenerationRef.current ||
          !isMountedRef.current
        ) {
          return;
        }

        if (isPdfCancellationError(err)) {
          return;
        }

        console.error("PDF Render Error", err);
        const errMessage = normalizeUnknownError(
          err,
          "Unknown rendering error",
        );
        setRenderError(errMessage);
      }
    };

    renderPage();

    return () => {
      cancelled = true;
      if (localRenderTask) {
        try {
          localRenderTask.cancel();
        } catch {
          // ignore
        }
        if (renderTaskRef.current === localRenderTask) {
          renderTaskRef.current = null;
        }
      }
    };
  }, [visiblePdfDoc, scale, visiblePageNumber]);

  const handlePdfDoubleClick = async (event: MouseEvent<HTMLCanvasElement>) => {
    const syncTex = compileResult?.syncTex;
    const canvas = canvasRef.current;
    if (!syncTex || !canvas || !visiblePdfDoc) return;

    const bounds = canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / scale;
    const y = (event.clientY - bounds.top) / scale;
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0) return;

    setSyncTexStatus("Looking up source…");
    try {
      const source = await querySyncTexReverse({
        artifactId: syncTex.id,
        page: visiblePageNumber,
        x,
        y,
      });
      if (!source) {
        setSyncTexStatus("No source location found for this PDF point.");
        return;
      }

      const normalizedInput = source.inputPath.replace(/\\/g, "/");
      const file = files.find(
        (candidate) =>
          !candidate.isFolder &&
          (candidate.path === normalizedInput ||
            normalizedInput.endsWith(`/${candidate.path}`)),
      );
      if (!file) {
        setSyncTexStatus(`Source file not found: ${source.inputPath}`);
        return;
      }

      goToLine(file.id, source.line);
      setSyncTexStatus(`${file.path}:${source.line}`);
    } catch (error) {
      console.error("SyncTeX reverse lookup failed", error);
      setSyncTexStatus(
        normalizeUnknownError(error, "SyncTeX reverse lookup failed"),
      );
    }
  };

  const handleDownload = () => {
    const bytes = compileResult?.pdfBytes;
    if (!bytes || bytes.length === 0) return;
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = currentProject?.name
      ? `${currentProject.name}.pdf`
      : "document.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isCompiling && !compileResult?.pdfBytes) {
    return (
      <div className="w-full h-full bg-zinc-950 flex flex-col items-center justify-center text-zinc-300 overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.12),transparent_35%)]" />
        <div className="relative flex flex-col items-center gap-4 rounded-2xl border border-emerald-900/50 bg-zinc-900/80 px-8 py-7 shadow-2xl shadow-emerald-950/20">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl animate-pulse" />
            <Loader2 className="relative w-10 h-10 animate-spin text-emerald-400" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-emerald-100">
              Compiling PDF…
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Running selected local TeX engine and preparing preview.
            </p>
          </div>
          <div className="h-1.5 w-48 overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full w-1/2 animate-[pulse_1.2s_ease-in-out_infinite] rounded-full bg-emerald-500" />
          </div>
        </div>
      </div>
    );
  }

  if (!compileResult?.success && !compileResult?.pdfBytes) {
    if (!currentProject) {
      return (
        <div
          id="pdf-viewer-empty-project"
          className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-500"
        >
          No project opened
        </div>
      );
    }
    return (
      <div
        id="pdf-viewer-no-pdf"
        className="w-full h-full bg-zinc-900 flex flex-col items-center justify-center text-zinc-500 p-8 text-center space-y-4"
      >
        <AlertTriangle className="w-12 h-12 text-zinc-600" />
        <p>No PDF available.</p>
        <p className="text-sm">
          Click <strong>Compile</strong> to generate the PDF.
        </p>
      </div>
    );
  }

  return (
    <div
      id="pdf-viewer-root"
      className="w-full h-full flex flex-col bg-zinc-800"
    >
      {/* PDF Toolbar */}
      <div className="h-10 bg-zinc-900 border-b border-zinc-800 flex items-center px-4 justify-between shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            disabled={visiblePageNumber <= 1 || !visiblePdfDoc}
            className="text-zinc-400 hover:text-white disabled:opacity-50"
          >
            &larr;
          </button>
          <span className="text-xs font-mono text-zinc-300">
            Page {visiblePageNumber} of {visibleTotalPages || "-"}
          </span>
          {compileResult?.syncTex && (
            <span
              className="hidden md:inline text-[11px] text-emerald-400/80"
              title="Double-click the PDF preview to jump to the matching LaTeX source line."
            >
              SyncTeX reverse ready
            </span>
          )}
          <button
            onClick={() =>
              setPageNumber((p) => Math.min(visibleTotalPages, p + 1))
            }
            disabled={visiblePageNumber >= visibleTotalPages || !visiblePdfDoc}
            className="text-zinc-400 hover:text-white disabled:opacity-50"
          >
            &rarr;
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setScale((s) => s * 0.8)}
            disabled={!visiblePdfDoc}
            className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded disabled:opacity-50"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono w-12 text-center text-zinc-300">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => s * 1.2)}
            disabled={!visiblePdfDoc}
            className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded disabled:opacity-50"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-zinc-700 mx-2" />

          <button
            onClick={handleDownload}
            disabled={
              !compileResult?.pdfBytes || compileResult.pdfBytes.length === 0
            }
            className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded disabled:opacity-50"
            title="Download PDF"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* PDF Content Area */}
      <div className="flex-1 overflow-auto bg-zinc-950 p-4 relative text-center">
        {isCompiling && (
          <div className="absolute inset-0 bg-zinc-950/45 backdrop-blur-[1px] z-10 flex items-center justify-center">
            <div className="bg-zinc-900/95 text-zinc-100 border border-emerald-900/60 text-sm px-5 py-4 rounded-xl shadow-2xl shadow-black/60 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
              <div>
                <p className="font-medium">Compiling PDF…</p>
                <p className="text-xs text-zinc-500">
                  Preview updates when build finishes.
                </p>
              </div>
            </div>
          </div>
        )}

        {renderError ? (
          <div className="text-red-400 mt-10">
            Error rendering PDF: {renderError}
          </div>
        ) : (
          <div className="inline-block relative shadow-2xl ring-1 ring-zinc-800 bg-white">
            <canvas
              ref={canvasRef}
              onDoubleClick={handlePdfDoubleClick}
              className={`block shadow-sm ${compileResult?.syncTex ? "cursor-crosshair" : ""}`}
              title={
                compileResult?.syncTex
                  ? "Double-click a PDF point to jump to source"
                  : undefined
              }
            />
            {syncTexStatus && (
              <div className="absolute left-2 bottom-2 max-w-[calc(100%-1rem)] truncate rounded bg-zinc-950/85 px-2 py-1 text-[11px] text-zinc-200 shadow-lg">
                {syncTexStatus}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
