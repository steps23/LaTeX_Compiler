import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import cookieParser from "cookie-parser";
import { config } from "./server/config";
import { authRouter } from "./server/auth";
import { sessionRouter } from "./server/session";
import { apiRouter } from "./server/api";

async function startServer() {
  const app = express();
  const PORT = Number(config.PORT);

  app.use(express.json({ limit: "50mb" }));
  app.use(cookieParser());

  // Mount routers
  app.use("/api/auth", authRouter);
  app.use("/api/session", sessionRouter);
  app.use("/api", apiRouter);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
