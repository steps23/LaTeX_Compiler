import express from "express";

export const apiRouter = express.Router();

// API Route to proxy compilation request avoiding browser CORS
apiRouter.post("/compile", async (req, res) => {
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

    const fetchReqUrl = "https://texlive.net/cgi-bin/latexcgi";
    const response = await fetch(fetchReqUrl, {
      method: "POST",
      body: form,
    });

    const contentType = response.headers.get("content-type") || "";

    if (
      !response.ok ||
      contentType.includes("text/plain") ||
      contentType.includes("text/html")
    ) {
      const errorText = await response.text();
      return res.status(400).json({ success: false, log: errorText });
    }

    const buffer = await response.arrayBuffer();
    res.setHeader("Content-Type", "application/pdf");
    res.send(Buffer.from(buffer));
  } catch (err: unknown) {
    console.error("Compile error:", err);
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});
