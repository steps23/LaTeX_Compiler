import { CompileResult, CompileMessage, FileNode, LatexCompiler } from "../../types";

export class HttpFallbackCompiler implements LatexCompiler {
  async initialize(): Promise<void> {
    // Nothing to initialize
  }

  async compile(files: FileNode[], mainPath: string): Promise<CompileResult> {
    const mainFile = files.find(f => f.path === mainPath);
    if (!mainFile || !mainFile.content) {
      throw new Error(`Main file ${mainPath} not found or empty.`);
    }

    const startTime = Date.now();
    try {
      // For immediate preview reliability in guest environments,
      // we proxy via our own server to avoid CORS issues
      const response = await fetch('/api/compile', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mainContent: mainFile.content })
      });
      
      if (!response.ok) {
        let rawLog = "Unknown error";
        try {
          // Check if json
          const isJson = response.headers.get("content-type")?.includes("application/json");
          if (isJson) {
             const jsonResp = await response.json();
             rawLog = jsonResp.log || jsonResp.error || JSON.stringify(jsonResp);
          } else {
             rawLog = await response.text();
          }
        } catch(e) {}
      
      const errors: CompileMessage[] = [];
      const lines = rawLog.split('\n');
      for (const line of lines) {
        // very basic pdflatex error matching:
        // ! undefined control sequence. l.12 \badcommand
        // file.tex:12: error message
        const match = line.match(/^([a-zA-Z0-9_\-\.]+):(\d+):(.*)$/) || line.match(/l\.(\d+)\s(.*)/);
        if (match) {
          if (match.length === 4) {
             errors.push({ severity: 'error', file: match[1], line: parseInt(match[2], 10), message: match[3].trim(), context: line });
          } else {
             errors.push({ severity: 'error', file: mainPath, line: parseInt(match[1], 10), message: match[2].trim(), context: line });
          }
        }
      }
      
      // Also catch explicit ! LaTeX Error: ...
      const explicitErrorMatch = rawLog.match(/!\s*(.*?)(?=\n\n|\Z)/s);
      let fallbackMessage = explicitErrorMatch ? explicitErrorMatch[1].trim() : "Compilation request failed: " + response.statusText;
      fallbackMessage = fallbackMessage.substring(0, 150);

      if (errors.length === 0) {
         errors.push({ severity: 'error', message: fallbackMessage });
      }

      return {
        success: false,
        rawLog: rawLog,
        errors: errors,
        warnings: [],
        durationMs: Date.now() - startTime
      };
      }

      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      
      return {
        success: true,
        pdfBytes: new Uint8Array(arrayBuffer),
        rawLog: "Compilation succeeded cleanly via fallback engine.\n",
        errors: [],
        warnings: [],
        durationMs: Date.now() - startTime
      };
    } catch (err: any) {
      return {
        success: false,
        rawLog: err.toString(),
        errors: [{ severity: 'error', message: err.message }],
        warnings: [],
        durationMs: Date.now() - startTime
      };
    }
  }

  cancel(): void {
    // Cannot cancel simple HTTP request trivially without AbortController state
  }

  dispose(): void {
  }
}
