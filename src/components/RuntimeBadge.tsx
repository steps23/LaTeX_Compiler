import { Globe, Monitor } from "lucide-react";
import { useEffect, useState } from "react";
import { getRuntimeInfo, RuntimeInfo } from "../utils/runtime";

export function RuntimeBadge() {
  const [runtime, setRuntime] = useState<RuntimeInfo["runtime"]>("browser");

  useEffect(() => {
    let active = true;
    getRuntimeInfo()
      .then((info) => {
        if (active) setRuntime(info.runtime);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const isDesktop = runtime === "tauri";
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400 bg-zinc-800/50 px-2 py-1 rounded-sm">
      {isDesktop ? (
        <Monitor className="w-3.5 h-3.5" aria-hidden="true" />
      ) : (
        <Globe className="w-3.5 h-3.5" aria-hidden="true" />
      )}
      {isDesktop ? "Desktop" : "Browser"}
    </div>
  );
}
