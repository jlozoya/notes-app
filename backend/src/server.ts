import http from "http";
import { Server } from "socket.io";
import { createApp, allowedOrigins } from "./app";
import { setupNoteSockets } from "./sockets/notes.socket";

export function resolvePort(input?: number | string | null) {
  if (typeof input === "number" && Number.isFinite(input) && input > 0) return input;
  if (typeof input === "string" && /^\d+$/.test(input)) return parseInt(input, 10);
  const env = process.env.PORT;
  if (env && /^\d+$/.test(env)) return parseInt(env, 10);
  return 4000;
}

export function createServer() {
  const app = createApp();
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        const ok = allowedOrigins.some(o => o instanceof RegExp ? o.test(origin) : o === origin);
        cb(ok ? null : new Error("CORS blocked"), ok);
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
    path: "/socket.io",
  });

  setupNoteSockets(io);

  return {
    app,
    io,
    httpServer,
    async start(port?: number) {
      const p = resolvePort(port);
      return await new Promise<number>((resolve) => {
        const listener = httpServer.listen(p, () => {
          // @ts-ignore
          resolve((listener.address()?.port as number) ?? p);
        });
      });
    },
    async stop() {
      io.removeAllListeners();
      io.close();
      await new Promise<void>((res, rej) => httpServer.close(err => err ? rej(err) : res()));
    },
  };
}
