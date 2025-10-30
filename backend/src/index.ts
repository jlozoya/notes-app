/**
 * Entry Point (Bootstrap)
 * -----------------------
 * Loads environment variables, connects to MongoDB, creates the HTTP+WebSocket
 * server, and starts listening. Logs the bound port on success.
 *
 * Responsibilities
 * - Load `.env` (via `dotenv/config`)
 * - Initialize DB connection (`connectDB`)
 * - Compose Express + Socket.IO server (`createServer`)
 * - Start server on resolved port and log readiness
 *
 * Notes
 * - `connectDB()` should throw or reject on failure, preventing the server from
 *   starting without a database connection.
 * - `createServer().start()` resolves the actual port (useful when PORT=0).
 */

import "dotenv/config";
import { connectDB } from "./config/db";
import { createServer } from "./server";

(async () => {
  // Establish database connection before accepting any requests.
  await connectDB();

  // Create the HTTP + Socket.IO server.
  const srv = createServer();

  // Start listening (port is resolved internally; defaults typically to 4000).
  const port = await srv.start();

  // Log a friendly startup message with the final bound port.
  console.log(`🚀 Server running on port ${port}`);
})();
