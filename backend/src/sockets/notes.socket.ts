import { Server, Socket } from "socket.io";
import { Note } from "../models/Note";

export function setupNoteSockets(io: Server) {
  io.on("connection", (socket: Socket) => {
    socket.on("join", async (noteId) => {
      socket.join(noteId);
      const note = await Note.findById(noteId);
      if (note) socket.emit("load-note", { html: note.html, title: note.title });
    });

    socket.on("edit", async ({ id, html, title }) => {
      await Note.findByIdAndUpdate(id, { html, title, updatedAt: new Date() });
      socket.to(id).emit("update", { html, title });
    });
  });
}
