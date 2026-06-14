import { File, FileText, ChevronDown, ChevronRight, FileCode2, Image as ImageIcon } from 'lucide-react';
import { useEditorStore } from '../../state/store';

export function FileSidebar() {
  const { files, activeFileId, setActiveFile } = useEditorStore();
  
  const getIcon = (name: string) => {
    if (name.endsWith('.tex')) return <FileCode2 className="w-4 h-4 text-emerald-500" />;
    if (name.endsWith('.bib')) return <FileText className="w-4 h-4 text-blue-400" />;
    if (name.match(/\.(png|jpg|jpeg|svg)$/i)) return <ImageIcon className="w-4 h-4 text-purple-400" />;
    return <File className="w-4 h-4 text-zinc-400" />;
  };

  return (
    <div className="w-full h-full bg-zinc-900 border-r border-zinc-800 flex flex-col pt-2 text-zinc-300">
      <div className="px-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Files</div>
      
      <div className="flex-1 overflow-y-auto">
        {files.map(file => (
          <div 
            key={file.id}
            onClick={() => setActiveFile(file.id)}
            className={`flex items-center gap-2 px-4 py-1.5 cursor-pointer select-none text-sm
              ${activeFileId === file.id ? 'bg-emerald-900/30 text-emerald-100 border-l-2 border-emerald-500' : 'hover:bg-zinc-800/50 text-zinc-400 border-l-2 border-transparent'}`}
          >
            {getIcon(file.name)}
            <span className="truncate">{file.name}</span>
          </div>
        ))}
        
        {files.length === 0 && (
          <div className="px-4 text-zinc-500 text-xs italic mt-4">No files.</div>
        )}
      </div>
    </div>
  );
}
