import { HttpFallbackCompiler } from "./HttpFallbackCompiler";

// Factory for getting the current compiler.
// We can swap this out to use WASM later when the worker is ready.

let compilerInstance: HttpFallbackCompiler | null = null;

export async function getCompiler() {
  if (!compilerInstance) {
    compilerInstance = new HttpFallbackCompiler();
    await compilerInstance.initialize();
  }
  return compilerInstance;
}
