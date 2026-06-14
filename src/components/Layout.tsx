import { useEffect } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Header } from './Header';
import { FileSidebar } from '../features/fileTree/FileSidebar';
import { MonacoEditorRenderer } from '../features/editor/MonacoEditor';
import { PdfViewer } from '../features/pdfViewer/PdfViewer';
import { useEditorStore } from '../state/store';
import { XCircle, AlertTriangle, Info } from 'lucide-react';

export function Layout() {
  const { loadInitialState, currentProject, createExampleProject, compileResult, logsVisible, toggleLogs, goToLine, files } = useEditorStore();

  useEffect(() => {
    loadInitialState();
  }, [loadInitialState]);

  const handleLogClick = (file: string | undefined, line: number | undefined) => {
    if (!file || !line) return;
    const targetFile = files.find(f => f.path === file || f.name === file);
    if (targetFile) {
      goToLine(targetFile.id, line);
    }
  };

  if (!currentProject) {
    return (
      <div className="w-screen h-screen bg-zinc-950 flex flex-col items-center justify-center text-zinc-200">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-600 rounded-md flex items-center justify-center text-lg shadow-lg">tf</div>
          TeXForge
        </h1>
        <p className="text-zinc-400 mb-8 max-w-md text-center">
          The collaborative LaTeX editor. Create a project to start editing.
        </p>
        <button 
          onClick={() => createExampleProject()}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-md font-medium shadow-lg transition-colors"
        >
          Create Example Article
        </button>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col bg-zinc-950 overflow-hidden font-sans">
      <Header />
      
      <div className="flex-1 min-h-0">
        <PanelGroup direction="horizontal">
          <Panel defaultSize={20} minSize={10} maxSize={50}>
            <FileSidebar />
          </Panel>
          
          <ResizeHandle />
          
          <Panel defaultSize={40} minSize={20}>
            <MonacoEditorRenderer />
          </Panel>
          
          <ResizeHandle />
          
          <Panel defaultSize={40} minSize={20}>
             <PdfViewer />
          </Panel>
        </PanelGroup>
      </div>

      {logsVisible && (
         <div className="h-48 shrink-0 bg-zinc-900 border-t border-zinc-800 flex flex-col z-20">
           <div className="h-8 border-b border-zinc-800 flex items-center px-4 justify-between bg-zinc-800/50">
             <div className="flex gap-4 text-xs font-medium text-zinc-400 uppercase tracking-wider">
               <button className="text-emerald-400">Logs</button>
               {compileResult && compileResult.errors.length > 0 && <button className="text-red-400">Errors ({compileResult.errors.length})</button>}
               {compileResult && compileResult.warnings.length > 0 && <button className="text-amber-400">Warnings ({compileResult.warnings.length})</button>}
             </div>
             <button onClick={toggleLogs} className="text-zinc-500 hover:text-white">✕</button>
           </div>
           
           <div className="flex-1 overflow-auto p-4 text-xs font-mono text-zinc-300">
             {compileResult ? (
                <>
                  {compileResult.errors.map((e, i) => (
                    <div 
                      key={'err'+i} 
                      onClick={() => handleLogClick(e.file, e.line)}
                      className={`flex gap-2 mb-1 p-1 rounded-sm ${e.file && e.line ? 'cursor-pointer hover:bg-zinc-800 text-red-300' : 'text-red-400'}`}
                    >
                      <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <div>
                         <span className="font-semibold mr-2">{e.file ? `${e.file}:${e.line}` : 'Error'}:</span>
                         <span>{e.message}</span>
                      </div>
                    </div>
                  ))}
                  <div className="whitespace-pre-wrap text-zinc-500 mt-2">
                    {compileResult.rawLog}
                  </div>
                </>
             ) : (
                <div className="text-zinc-600 italic">No compilation logs available yet. Press Compile to generate logs.</div>
             )}
           </div>
         </div>
      )}
    </div>
  );
}

function ResizeHandle() {
  return (
    <PanelResizeHandle className="w-1.5 flex flex-col items-center justify-center bg-zinc-900 border-x border-zinc-800 hover:bg-zinc-700 hover:border-zinc-700 transition-colors cursor-col-resize shrink-0 z-10 group relative outline-none">
       <div className="w-0.5 h-6 bg-zinc-700 rounded-full group-hover:bg-zinc-400 group-active:bg-emerald-500 transition-colors" />
    </PanelResizeHandle>
  );
}
