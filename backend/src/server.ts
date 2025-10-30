/**
 * HTTP + WebSocket Server Bootstrap
 * ---------------------------------
 * Creates an Express HTTP server and attaches a Socket.IO server configured with
 * CORS rules that mirror the REST API. Exposes lifecycle helpers to start/stop
 * the server for production or integration tests.
 *
 * Composition
 * - HTTP (Express): created via `createApp()` with routes and CORS.
 * - WebSocket (Socket.IO): created on top of the HTTP server, with:
 *   - CORS origin check against `allowedOrigins`
 *   - Custom namespace path `/socket.io`
 *   - Note collaboration handlers via `setupNoteSockets(io)`
 *
 * Public API
 * - resolvePort(input?): number
 * - createServer(): {
 *     app: Express,
 *     io: Server,
 *     httpServer: http.Server,
 *     start(port?: number): Promise<number>,
 *     stop(): Promise<void>
 *   }
 */

import http from "http";
import { Server } from "socket.io";
import { createApp, allowedOrigins } from "./app";
import { setupNoteSockets } from "./sockets/notes.socket";

/**
 * Resolves a listening port from:
 * 1) Explicit `input` (number or numeric string)
 * 2) `process.env.PORT` (numeric string)
 * 3) Fallback default: 4000
 *
 * @param input - Optional port candidate (number or numeric string).
 * @returns A valid port number (> 0).
 */
export function resolvePort(input?: number | string | null) {
  if (typeof input === "number" && Number.isFinite(input) && input > 0) return input;
  if (typeof input === "string" && /^\d+$/.test(input)) return parseInt(input, 10);
  const env = process.env.PORT;
  if (env && /^\d+$/.test(env)) return parseInt(env, 10);
  return 4000;
}

/**
 * Creates the HTTP and Socket.IO servers and wires up realtime note handlers.
 *
 * CORS behavior (Socket.IO):
 * - Allows requests with no `Origin` (server-to-server, same-origin).
 * - Allows origins matching any entry in `allowedOrigins` (string or RegExp).
 * - Rejects others with "CORS blocked".
 *
 * Socket.IO options:
 * - `path: "/socket.io"` — aligns with client configuration.
 * - `methods: ["GET", "POST"]` — preflight scope for websockets/polling.
 * - `credentials: true` — allows cookies/Authorization if needed.
 *
 * @returns An object with the Express app, Socket.IO instance, the HTTP server,
 *          and lifecycle helpers:
 *          - `start(port?)` → starts listening and resolves the actual port.
 *          - `stop()` → gracefully shuts down Socket.IO and HTTP servers.
 */
export function createServer() {
  const app = createApp();
  const httpServer = http.createServer(app);

  const io = new Server(httpServer, {
    cors: {
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        const ok = allowedOrigins.some(o => (o instanceof RegExp ? o.test(origin) : o === origin));
        cb(ok ? null : new Error("CORS blocked"), ok);
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
    path: "/socket.io",
  });

  // Register all realtime note collaboration handlers.
  setupNoteSockets(io);

  return {
    /** The configured Express application. */
    app,
    /** The Socket.IO server bound to `httpServer`. */
    io,
    /** The underlying Node HTTP server. */
    httpServer,

    /**
     * Starts the HTTP server listening on a resolved port.
     *
     * @param port - Optional desired port (number). If omitted, uses `resolvePort()`.
     * @returns A promise resolving to the actual port in use.
     */
    async start(port?: number) {
      const p = resolvePort(port);
      return await new Promise<number>((resolve) => {
        const listener = httpServer.listen(p, () => {
          // @ts-ignore Node's address typing is a bit loose; normalize to number.
          resolve((listener.address()?.port as number) ?? p);
        });
      });
    },

    /**
     * Gracefully stops Socket.IO and the HTTP server.
     * - Removes all listeners from the io instance.
     * - Closes the Socket.IO server.
     * - Closes the HTTP server and waits for all connections to end.
     *
     * @returns Promise<void> when shutdown completes.
     */
    async stop() {
      io.removeAllListeners();
      io.close();
      await new Promise<void>((res, rej) => httpServer.close(err => (err ? rej(err) : res())));
    },
  };
}
