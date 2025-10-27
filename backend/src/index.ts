import express from "express";
import "dotenv/config";
import http from "http";
import cors, { CorsOptions } from "cors";
import { Server } from "socket.io";
import { connectDB } from "./config/db";
import authRoutes from "./routes/auth.routes";
import notesRoutes from "./routes/notes.routes";
import { setupNoteSockets } from "./sockets/notes.socket";

const allowedOrigins: (string | RegExp)[] = [
  /^http:\/\/localhost(?::\d+)?$/,
  /^http:\/\/127\.0\.0\.1(?::\d+)?$/,
  /^https:\/\/(?:[a-z0-9-]+\.)*lozoya\.org(?::\d+)?$/
];

const corsOptions: CorsOptions = {
  origin: (origin, cb) => {
    if (origin && allowedOrigins.some(o => o instanceof RegExp ? o.test(origin) : o === origin)) {
      return cb(null, true);
    }
    if (!origin) {
      return cb(null, true);
    }
    return cb(new Error("CORS blocked"));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  maxAge: 86400,
};

const app = express();
app.use(cors(corsOptions));
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/notes", notesRoutes);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const ok = allowedOrigins.some(o => o instanceof RegExp ? o.test(origin) : o === origin);
      cb(ok ? null : new Error("CORS blocked"), ok);
    },
    methods: ["GET","POST"],
    credentials: true,
  }
});
setupNoteSockets(io);

connectDB().then(() => {
  const PORT = process.env.PORT || 4000;
  server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
});
