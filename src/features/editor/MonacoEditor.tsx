import { useRef, useEffect } from 'react';
import { useEditorStore } from '../../state/store';
import { Type, PlaySquare, ArrowLeftRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import Editor from '@monaco-editor/react';

export function MonacoEditorRenderer() {
  const { files, activeFileId, activeLine, updateFileContent } = useEditorStore();
  const editorRef = useRef<any>(null);
  
  const activeFile = files.find(f => f.id === activeFileId);

  useEffect(() => {
    if (editorRef.current && activeLine) {
      editorRef.current.revealLineInCenter(activeLine);
      editorRef.current.setPosition({ lineNumber: activeLine, column: 1 });
      editorRef.current.focus();
    }
  }, [activeLine, activeFileId]);

  // Set line when activeLine changes
  const handleEditorMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    if (activeLine) {
      editor.revealLineInCenter(activeLine);
      editor.setPosition({ lineNumber: activeLine, column: 1 });
      editor.focus();
    }
  };

  if (!activeFile) {
    return (
      <div className="w-full h-full bg-zinc-950 flex shadow-inner flex-col text-zinc-500 items-center justify-center">
        Select a file to start editing.
      </div>
    );
  }

  // Set the monaco language based on the file extension
  const language = activeFile.name.endsWith('.tex') ? 'latex' 
                   : activeFile.name.endsWith('.bib') ? 'bibtex' 
                   : 'plaintext';

  return (
    <div className="w-full h-full flex flex-col bg-zinc-950">
      <div className="h-10 bg-zinc-900 border-b border-zinc-800 flex items-center px-4 justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono text-zinc-300">{activeFile.name}</span>
          <span className="text-xs text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded-full ring-1 ring-zinc-700">Source</span>
        </div>
        <div className="flex items-center gap-1">
           <button className="p-1.5 text-zinc-400 hover:text-white rounded-md hover:bg-zinc-800 transition-colors" title="Visual Beta (Disabled)">
             <ArrowLeftRight className="w-4 h-4" />
           </button>
        </div>
      </div>
      <div className="flex-1 relative">
        <Editor
          height="100%"
          language={language}
          value={activeFile.content || ''}
          theme="vs-dark"
          onMount={handleEditorMount}
          onChange={(val) => {
            if (val !== undefined) {
              updateFileContent(activeFile.id, val);
            }
          }}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            wordWrap: "on",
            lineNumbersMinChars: 3,
            scrollBeyondLastLine: false,
            padding: { top: 16 },
            fontFamily: "'JetBrains Mono', monospace",
          }}
        />
      </div>
    </div>
  );
}
