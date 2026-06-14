import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // API Route to proxy compilation request avoiding browser CORS
  app.post("/api/compile", async (req, res) => {
    try {
      const { mainContent } = req.body;
      if (!mainContent) {
        return res.status(400).json({ error: "Missing mainContent" });
      }

      const form = new FormData();
      form.append("filecontents[]", mainContent);
      form.append("filename[]", "document.tex");
      form.append("engine", "pdflatex");
      form.append("return", "pdf");

      const fetchReqUrl = 'https://texlive.net/cgi-bin/latexcgi';
      const response = await fetch(fetchReqUrl, {
         method: "POST",
         body: form
      });

      const contentType = response.headers.get("content-type") || "";

      if (!response.ok || contentType.includes("text/plain") || contentType.includes("text/html")) {
        const errorText = await response.text();
        return res.status(400).json({ success: false, log: errorText });
      }

      const buffer = await response.arrayBuffer();
      res.setHeader("Content-Type", "application/pdf");
      res.send(Buffer.from(buffer));
    } catch (err: any) {
      console.error("Compile error:", err);
      res.status(500).json({ error: err.message });
    }
  });

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
