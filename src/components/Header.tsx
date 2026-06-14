import { Upload, Play, Loader, Folder, File, Share2, Download, Menu, Settings } from 'lucide-react';
import { useEditorStore } from '../state/store';
import { getCompiler } from '../features/compiler';

export function Header() {
  const { currentProject, files, isCompiling, setCompiling, setCompileResult, toggleLogs } = useEditorStore();

  const handleCompile = async () => {
    if (!currentProject || isCompiling) return;
    
    setCompiling(true);
    try {
      const compiler = await getCompiler();
      const result = await compiler.compile(files, currentProject.mainFilePath);
      setCompileResult(result);
    } catch (err: any) {
      setCompileResult({
        success: false,
        rawLog: err.message,
        errors: [{ severity: 'error', message: err.message }],
        warnings: [],
        durationMs: 0
      });
    } finally {
      setCompiling(false);
    }
  };

  return (
    <div className="h-14 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4 text-zinc-300 shadow-sm z-10 shrink-0">
      <div className="flex items-center gap-4">
        <div className="font-bold text-xl tracking-tight text-white flex items-center gap-2">
          <div className="w-6 h-6 bg-emerald-600 rounded-sm flex items-center justify-center text-sm">tf</div>
          TeXForge
        </div>
        
        <div className="hidden md:flex gap-1 bg-zinc-800/50 p-1 rounded-sm text-sm border border-zinc-700/50">
          <button className="px-3 py-1 hover:bg-zinc-700 hover:text-white rounded-sm transition-colors">File</button>
          <button className="px-3 py-1 hover:bg-zinc-700 hover:text-white rounded-sm transition-colors">Edit</button>
          <button className="px-3 py-1 hover:bg-zinc-700 hover:text-white rounded-sm transition-colors">Project</button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-sm font-medium text-zinc-400 mr-2 max-w-[200px] truncate">
          {currentProject?.name}
        </div>
        <button 
          onClick={handleCompile}
          disabled={isCompiling || !currentProject}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white px-4 py-1.5 rounded-sm font-medium flex items-center gap-2 transition-colors text-sm"
        >
          {isCompiling ? <Loader className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Compile
        </button>
        <button 
          onClick={toggleLogs}
          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-sm flex items-center gap-2 transition-colors text-sm border border-zinc-700"
        >
          Logs
        </button>
        <button className="bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 px-3 py-1.5 rounded-sm flex items-center gap-2 transition-colors text-sm font-medium">
          <Share2 className="w-4 h-4" />
          Share
        </button>
      </div>
    </div>
  );
}
