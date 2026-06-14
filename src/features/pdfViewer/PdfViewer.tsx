import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { useEditorStore } from '../../state/store';
import { ZoomIn, ZoomOut, Download, AlertTriangle } from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export function PdfViewer() {
  const { compileResult, isCompiling, currentProject } = useEditorStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(1.5);
  const [pageNumber, setPageNumber] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);

  // Load PDF Document only when bytes change
  useEffect(() => {
    if (!compileResult?.pdfBytes || compileResult.pdfBytes.length === 0) {
      setPdfDoc(null);
      return;
    }

    let isMounted = true;
    const loadingTask = pdfjsLib.getDocument({ data: compileResult.pdfBytes });
    
    loadingTask.promise.then(doc => {
      if (isMounted) {
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setRenderError(null);
      }
    }).catch((err: any) => {
      if (isMounted) {
        console.error("PDF Load Error", err);
        setRenderError(err.message);
      }
    });

    return () => {
      isMounted = false;
      loadingTask.destroy();
    };
  }, [compileResult?.pdfBytes]);

  // Render Page when doc, scale, or page changes
  useEffect(() => {
    if (!pdfDoc) return;

    let renderTask: pdfjsLib.RenderTask | null = null;
    
    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const context = canvas.getContext('2d');
        if (!context) return;
        
        const viewport = page.getViewport({ scale });
        
        // Support HiDPI-displays
        const outputScale = window.devicePixelRatio || 1;
        
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = Math.floor(viewport.width) + "px";
        canvas.style.height =  Math.floor(viewport.height) + "px";
        
        const transform = outputScale !== 1 
          ? [outputScale, 0, 0, outputScale, 0, 0] 
          : null;
        
        const renderContext: any = {
          canvasContext: context,
          transform: transform || undefined,
          viewport: viewport
        };
        
        if (renderTask) {
           renderTask.cancel();
        }
        
        renderTask = page.render(renderContext);
        await renderTask.promise;
        
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') {
          console.error("PDF Render Error", err);
          setRenderError(err.message);
        }
      }
    };

    renderPage();
    
    return () => {
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, scale, pageNumber]);

  if (!compileResult?.success && !compileResult?.pdfBytes) {
    if (!currentProject) {
        return <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-500">No project opened</div>;
    }
    return (
      <div className="w-full h-full bg-zinc-900 flex flex-col items-center justify-center text-zinc-500 p-8 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-zinc-600" />
        <p>No PDF available.</p>
        <p className="text-sm">Click <strong>Compile</strong> to generate the PDF.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-zinc-800">
      {/* PDF Toolbar */}
      <div className="h-10 bg-zinc-900 border-b border-zinc-800 flex items-center px-4 justify-between shrink-0">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setPageNumber(p => Math.max(1, p - 1))}
            disabled={pageNumber <= 1}
            className="text-zinc-400 hover:text-white disabled:opacity-50"
          >
            &larr;
          </button>
          <span className="text-xs font-mono text-zinc-300">
            Page {pageNumber} of {totalPages || '-'}
          </span>
          <button 
            onClick={() => setPageNumber(p => Math.min(totalPages, p + 1))}
            disabled={pageNumber >= totalPages}
            className="text-zinc-400 hover:text-white disabled:opacity-50"
          >
            &rarr;
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <button onClick={() => setScale(s => s * 0.8)} className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded">
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono w-12 text-center text-zinc-300">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => s * 1.2)} className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded">
            <ZoomIn className="w-4 h-4" />
          </button>
          
          <div className="w-px h-4 bg-zinc-700 mx-2" />
          
          <button className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded" title="Download PDF">
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
          <div className="text-red-400 mt-10">Error rendering PDF: {renderError}</div>
        ) : (
          <div className="inline-block relative shadow-2xl ring-1 ring-zinc-800 bg-white">
            <canvas ref={canvasRef} className="block shadow-sm" />
          </div>
        )}
      </div>
    </div>
  );
}
