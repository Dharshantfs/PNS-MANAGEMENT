import { createApiApp } from "../server/app";

// Vercel serverless function entrypoint. Named with a catch-all filename
// ([...path]) so Vercel natively routes every /api/* request here on its
// own - unlike api/index.ts, which Vercel only maps to the exact path
// /api, requiring a vercel.json rewrite that turned out not to reliably
// reach the function in practice (requests weren't showing up in Vercel's
// function logs at all - a routing problem, not a crash in the code).
//
// Deploys the same Express API routes used by server.ts, without the Vite
// dev middleware / static file serving (Vercel's static build output
// handles the frontend separately - see vercel.json).
export default createApiApp();
