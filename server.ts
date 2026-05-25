import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { app, readDB, writeDB } from "./src/createApp";

async function startServer() {
  const PORT = 3000;

  // Handle Vite middleware in development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Handle process unhandled rejections to prevent crashing
  process.on("unhandledRejection", (reason, promise) => {
    console.warn("Unhandled Rejection at:", promise, "reason:", reason);
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Nextify SAAS Framework] Server running on http://localhost:${PORT}`);
  });
}

startServer();
