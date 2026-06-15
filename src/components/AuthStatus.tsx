import { useState, useEffect } from "react";
import { LogOut, User as UserIcon } from "lucide-react";

interface Account {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export function AuthStatus() {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<"expired" | null>(null);

  const fetchSession = async () => {
    try {
      const res = await fetch("/api/session/current");
      if (res.ok) {
        const data = await res.json();
        setAccount(data.account);
        setErrorStatus(null);
      } else if (res.status === 401) {
        const data = await res.json();
        if (data.revoked || data.error.includes("expired")) {
          setErrorStatus("expired");
        }
        setAccount(null);
      } else {
        setAccount(null);
        setErrorStatus(null);
      }
    } catch {
      setAccount(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();

    const handleMessage = (event: MessageEvent) => {
      if (
        (event.origin.endsWith(".run.app") ||
          event.origin.includes("localhost")) &&
        event.data?.type === "OAUTH_AUTH_SUCCESS"
      ) {
        fetchSession();
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleConnect = async () => {
    try {
      const res = await fetch("/api/auth/url");
      if (!res.ok) throw new Error("Failed to get auth URL");
      const { url } = await res.json();

      const authWindow = window.open(
        url,
        "oauth_popup",
        "width=600,height=700",
      );
      if (!authWindow) {
        alert("Please allow popups to connect your Google account.");
      }
    } catch (err) {
      console.error(err);
      alert("Error connecting to Google.");
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/session/logout", { method: "POST" });
      setAccount(null);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="text-zinc-500 text-sm animate-pulse px-2">Loading...</div>
    );
  }

  if (account) {
    return (
      <div className="flex items-center gap-3 bg-zinc-800/60 px-3 py-1.5 rounded-full border border-zinc-700/50">
        {account.picture ? (
          <img
            src={account.picture}
            alt=""
            className="w-6 h-6 rounded-full"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-6 h-6 bg-zinc-700 rounded-full flex items-center justify-center">
            <UserIcon className="w-3.5 h-3.5 text-zinc-400" />
          </div>
        )}
        <div className="text-xs font-medium text-zinc-200 hidden sm:block">
          {account.name}
        </div>
        <button
          onClick={handleLogout}
          title="Disconnect Google Account"
          className="text-zinc-400 hover:text-red-400 p-1 rounded-full hover:bg-zinc-700/80 transition-colors ml-1"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {errorStatus === "expired" && (
        <span className="text-red-400 text-xs font-medium">
          Session expired
        </span>
      )}
      <button
        onClick={handleConnect}
        className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 text-sm font-medium rounded-full shadow-sm flex items-center gap-2 transition-colors border border-blue-500"
      >
        <span className="w-4 h-4 rounded bg-white flex items-center justify-center shrink-0 shadow-inner">
          <svg className="w-3 h-3" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
            <path fill="none" d="M1 1h22v22H1z" />
          </svg>
        </span>
        Connect Google
      </button>
    </div>
  );
}
