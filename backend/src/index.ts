import express from "express";
import "dotenv/config";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import { connectDB } from "./config/db";
import authRoutes from "./routes/auth.routes";
import notesRoutes from "./routes/notes.routes";
import { setupNoteSockets } from "./sockets/notes.socket";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/notes", notesRoutes);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
setupNoteSockets(io);

connectDB().then(() => {
  const PORT = process.env.PORT || 4000;
  server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
});
