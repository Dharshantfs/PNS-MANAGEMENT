import { createApiApp } from "../server/app";

// Vercel serverless function entrypoint: deploys the same Express API routes
// used by server.ts, without the Vite dev middleware / static file serving
// (Vercel's static build output handles the frontend separately - see
// vercel.json). Vercel's Node runtime can invoke an Express app exported as
// the default export directly.
export default createApiApp();
