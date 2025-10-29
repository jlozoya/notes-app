import express from "express";
import cors, { CorsOptions } from "cors";
import userRoutes from "./routes/user.routes";
import authRoutes from "./routes/auth.routes";
import notesRoutes from "./routes/notes.routes";

export const allowedOrigins: (string | RegExp)[] = [
  /^http:\/\/localhost(?::\d+)?$/,
  /^http:\/\/127\.0\.0\.1(?::\d+)?$/,
  /^https:\/\/(?:[a-z0-9-]+\.)*lozoya\.org(?::\d+)?$/,
];

export const corsOptions: CorsOptions = {
  origin: (origin, cb) => {
    if (origin && allowedOrigins.some(o => o instanceof RegExp ? o.test(origin) : o === origin)) {
      return cb(null, true);
    }
    if (!origin) return cb(null, true);
    return cb(new Error("CORS blocked"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  maxAge: 86400,
};

export function createApp() {
  const app = express();
  app.use(cors(corsOptions));
  app.use(express.json());
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/user", userRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/notes", notesRoutes);
  return app;
}
