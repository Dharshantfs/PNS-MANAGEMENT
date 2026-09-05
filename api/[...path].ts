import { createApiApp } from "./_lib/app";

// Vercel serverless function entrypoint. Named with a catch-all filename
// ([...path]) so Vercel natively routes every /api/* request here on its
// own - unlike api/index.ts, which Vercel only maps to the exact path
// /api, requiring a vercel.json rewrite that turned out not to reliably
// reach the function in practice.
//
// The actual Express app lives in ./_lib/app.ts, NOT in a top-level
// server/ folder outside api/ - Vercel's function bundler only reliably
// traces and includes files that live inside the api/ directory tree.
// A previous version imported from "../server/app" and built/deployed
// "successfully" (the function showed up in Vercel's dashboard) but
// crashed on every actual invocation with
// `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/server/app'`
// - the file simply wasn't in the deployed bundle. Moving the shared code
// under api/_lib fixes that; local dev (server.ts) imports the same file.
export default createApiApp();
