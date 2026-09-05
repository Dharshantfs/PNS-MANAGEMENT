import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createApiApp } from "./api/_lib/app";

// Traditional long-running Node server (Render/Railway/a VM, or local `npm
// run dev`). The API routes themselves live in api/_lib/app.ts (not a
// top-level server/ folder - Vercel's function bundler only reliably
// traces files inside the api/ directory) so they can be reused as-is by
// api/[...path].ts for the Vercel serverless deployment.
async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3001;

  app.use(createApiApp());

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
    console.log(`PG Management server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
