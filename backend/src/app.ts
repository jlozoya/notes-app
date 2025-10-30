/**
 * HTTP App Bootstrap (Express)
 * ---------------------------
 * Central Express app factory with CORS, JSON parsing, health check, and route mounting.
 *
 * Mounted routes:
 * - GET    /health             → Liveness probe
 * - /api/user  (user.routes)   → Profile, account mgmt, deletion flow
 * - /api/auth  (auth.routes)   → Signup, login, email verify, password reset
 * - /api/notes (notes.routes)  → Notes CRUD and sharing
 *
 * CORS policy:
 * - Allows localhost (IPv4 + 127.0.0.1) and *.lozoya.org across subdomains/ports.
 * - Blocks all other origins with "CORS blocked".
 * - Credentials enabled and common headers/methods whitelisted.
 */

import express from "express";
import cors, { CorsOptions } from "cors";
import userRoutes from "./routes/user.routes";
import authRoutes from "./routes/auth.routes";
import notesRoutes from "./routes/notes.routes";

/**
 * Whitelisted origins for CORS.
 * - localhost (any port)
 * - 127.0.0.1 (any port)
 * - Any subdomain of lozoya.org (optionally with port)
 *
 * Notes:
 * - Use RegExp entries for pattern-based matching.
 * - Add additional origins here if you expose the API to other frontends.
 */
export const allowedOrigins: (string | RegExp)[] = [
  /^http:\/\/localhost(?::\d+)?$/,
  /^http:\/\/127\.0\.0\.1(?::\d+)?$/,
  /^https:\/\/(?:[a-z0-9-]+\.)*lozoya\.org(?::\d+)?$/,
];

/**
 * CORS configuration for the API.
 *
 * Behavior:
 * - `origin`: Allows requests whose Origin matches any `allowedOrigins` entry.
 *   - If `origin` is undefined (e.g., curl, same-origin SSR), allow by default.
 *   - Otherwise, reject with Error("CORS blocked").
 * - `methods`: Standard REST verbs + OPTIONS.
 * - `allowedHeaders`: Content-Type and Authorization for JSON & Bearer flows.
 * - `credentials`: true → allows cookies/Authorization headers across origins.
 * - `maxAge`: 86400 → cache preflight (OPTIONS) responses for 24 hours.
 */
export const corsOptions: CorsOptions = {
  origin: (origin, cb) => {
    if (origin && allowedOrigins.some(o => (o instanceof RegExp ? o.test(origin) : o === origin))) {
      return cb(null, true);
    }
    // Allow requests without an Origin (e.g., server-to-server, curl)
    if (!origin) return cb(null, true);
    return cb(new Error("CORS blocked"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  maxAge: 86400,
};

/**
 * Factory: create and configure an Express application.
 *
 * Middleware:
 * - CORS with `corsOptions`
 * - JSON body parsing (`express.json()`)
 *
 * Routes:
 * - GET /health → { ok: true } (for uptime/liveness checks)
 * - /api/user   → userRoutes
 * - /api/auth   → authRoutes
 * - /api/notes  → notesRoutes
 *
 * @returns Configured Express application instance (not yet listening).
 */
export function createApp() {
  const app = express();

  // Cross-origin request policy
  app.use(cors(corsOptions));

  // Parse application/json
  app.use(express.json());

  // Liveness / health check endpoint
  app.get("/health", (_req, res) => res.json({ ok: true }));

  // Feature routes
  app.use("/api/user", userRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/notes", notesRoutes);

  return app;
}
