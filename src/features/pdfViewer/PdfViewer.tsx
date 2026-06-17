import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useEditorStore } from "../../state/store";
import { ZoomIn, ZoomOut, Download, AlertTriangle } from "lucide-react";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

function isPdfCancellationError(err: unknown): boolean {
  if (err && typeof err === "object" && "name" in err) {
    return (
      err.name === "RenderingCancelledException" ||
      err.name === "PromiseCancelledException" ||
      err.name === "Context2DException"
    );
  }
  if (err && typeof err === "object" && "message" in err) {
    const msg = String((err as { message?: unknown }).message);
    return (
      msg.includes("RenderingCancelledException") || msg.includes("cancelled")
    );
  }
  return false;
}

export function PdfViewer() {
  const { compileResult, isCompiling, currentProject } = useEditorStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(1.5);
  const [pageNumber, setPageNumber] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);

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
    // 1. Immediately invalidate visible state synchronously BEFORE waiting for teardown or loading!
    /* eslint-disable react-hooks/set-state-in-effect */
    setPdfDoc(null);
    setTotalPages(0);
    setPageNumber(1);
    setRenderError(null);
    /* eslint-enable react-hooks/set-state-in-effect */

    // 2. Increment active generation token
    loadGenerationRef.current += 1;
    const currentGeneration = loadGenerationRef.current;

    let localLoadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;

    const loadDoc = async () => {
      const bytes = compileResult?.pdfBytes;

      // 3. Serialized destruction sequence to avoid race conditions (A -> B -> C)
      await destroyPromiseRef.current;

      // Check if we are still the active generation and is mounted
      if (
        currentGeneration !== loadGenerationRef.current ||
        !isMountedRef.current
      ) {
        return;
      }

      if (!bytes || bytes.length === 0) {
        return;
      }

      try {
        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        localLoadingTask = loadingTask;

        const doc = await loadingTask.promise;

        // Ensure generation integrity and mount before committing state
        if (
          currentGeneration === loadGenerationRef.current &&
          isMountedRef.current
        ) {
          setPdfDoc(doc);
          setTotalPages(doc.numPages);
          setPageNumber(1);
          setRenderError(null);
        } else {
          // If we loaded it but we're no longer the current generation, destroy it immediately to avoid leakage
          try {
            await doc.destroy();
          } catch {
            // ignore
          }
        }
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

        // Normalize errors safely (strings, null, non-errors, or Error objects)
        let errMessage = "Unknown loading error";
        if (err instanceof Error) {
          errMessage = err.message;
        } else if (typeof err === "string") {
          errMessage = err;
        } else if (err !== null && err !== undefined) {
          errMessage = String(err);
        }

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
      if (localLoadingTask) {
        const taskToDestroy = localLoadingTask;
        destroyPromiseRef.current = destroyPromiseRef.current.then(async () => {
          try {
            await taskToDestroy.destroy();
          } catch (err) {
            if (!isPdfCancellationError(err)) {
              console.error("PDF load task destruction error", err);
            }
          }
        });
      }
    };
  }, [compileResult?.pdfBytes]);

  // Render Page when doc, scale, or page changes
  useEffect(() => {
    if (!pdfDoc) {
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

    let renderTask: pdfjsLib.RenderTask | null = null;
    let cancelled = false;
    const currentLoadGen = loadGenerationRef.current;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);

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

        if (renderTask) {
          renderTask.cancel();
        }

        renderTask = page.render(renderContext);
        await renderTask.promise;
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

        // Normalize errors safely
        let errMessage = "Unknown rendering error";
        if (err instanceof Error) {
          errMessage = err.message;
        } else if (typeof err === "string") {
          errMessage = err;
        } else if (err !== null && err !== undefined) {
          errMessage = String(err);
        }

        setRenderError(errMessage);
      }
    };

    renderPage();

    return () => {
      cancelled = true;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, scale, pageNumber]);

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
            disabled={pageNumber <= 1 || !pdfDoc}
            className="text-zinc-400 hover:text-white disabled:opacity-50"
          >
            &larr;
          </button>
          <span className="text-xs font-mono text-zinc-300">
            Page {pageNumber} of {totalPages || "-"}
          </span>
          <button
            onClick={() => setPageNumber((p) => Math.min(totalPages, p + 1))}
            disabled={pageNumber >= totalPages || !pdfDoc}
            className="text-zinc-400 hover:text-white disabled:opacity-50"
          >
            &rarr;
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setScale((s) => s * 0.8)}
            disabled={!pdfDoc}
            className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded disabled:opacity-50"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono w-12 text-center text-zinc-300">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => s * 1.2)}
            disabled={!pdfDoc}
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
          <div className="absolute top-4 right-4 bg-zinc-800/90 text-zinc-200 border border-zinc-700 text-xs px-3 py-1.5 rounded-sm shadow border shadow-black/50 z-10 flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            Compiling...
          </div>
        )}

        {renderError ? (
          <div className="text-red-400 mt-10">
            Error rendering PDF: {renderError}
          </div>
        ) : (
          <div className="inline-block relative shadow-2xl ring-1 ring-zinc-800 bg-white">
            <canvas ref={canvasRef} className="block shadow-sm" />
          </div>
        )}
      </div>
    </div>
  );
}
