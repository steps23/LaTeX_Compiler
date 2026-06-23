import type { LatexCompiler } from "../../types";
import { isTauri } from "../../utils/runtime";
import { HttpFallbackCompiler } from "./HttpFallbackCompiler";
import { NativeLocalCompiler } from "./NativeLocalCompiler";

let compilerInstance: LatexCompiler | null = null;
let compilerRuntime: "browser" | "tauri" | null = null;

export async function getCompiler() {
  const runtime = isTauri() ? "tauri" : "browser";
  if (!compilerInstance || compilerRuntime !== runtime) {
    compilerInstance =
      runtime === "tauri"
        ? new NativeLocalCompiler()
        : new HttpFallbackCompiler();
    compilerRuntime = runtime;
    await compilerInstance.initialize();
  }
  return compilerInstance;
}
