// Explicit ".js" extension required: package.json has "type": "module", so
// Vercel's Node runtime resolves this import with the native ESM loader,
// which (unlike tsx/bundlers) does not resolve extensionless relative
// imports - this alone was causing every /api/* invocation to crash with
// ERR_MODULE_NOT_FOUND, independent of the routing bug fixed above.
import { createApiApp } from "./_lib/app.js";

// Vercel serverless function entrypoint.
//
// Previously this file was named api/[...path].ts, expecting Vercel's
// filesystem router to treat the bracket folder as a true multi-segment
// catch-all. Confirmed via `vercel build` + inspecting
// .vercel/output/config.json that it does NOT for this project (Vite/
// "Other" framework, not Next.js): Vercel generated the route regex
// `^/api/([^/]+)$` - matching exactly one path segment, no slashes - and
// hard-404'd everything else (`^/api(/.*)?$` -> status 404) *before* the
// function was ever invoked. That's why single-segment routes like
// /api/send-whatsapp-reminder worked while any two-segment route
// (/api/team/invite, /api/onboard/submit, etc.) returned a platform
// NOT_FOUND with zero Runtime Log entries, regardless of the route's
// name or when it was deployed - not a firewall or caching issue.
//
// Fix: use a plain, statically-named function (api/index.ts) plus an
// explicit `rewrites` rule in vercel.json that forwards every /api/*
// path here. Vercel preserves the original request path/query when
// forwarding a rewrite, so Express still sees the real incoming
// req.path (e.g. /api/team/invite) and routes it internally as before.
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
