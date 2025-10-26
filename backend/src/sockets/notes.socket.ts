import { Server, Socket } from "socket.io";
import mongoose from "mongoose";
import { Note } from "../models/Note";

function isValidObjectId(id: any) {
  return (
    typeof id === "string" &&
    mongoose.Types.ObjectId.isValid(id) &&
    new mongoose.Types.ObjectId(id).toString() === id
  );
}

export function setupNoteSockets(io: Server) {
  io.on("connection", (socket: Socket) => {
    socket.data.currentNoteId = null as string | null;

    const roomSize = (roomId: string) => {
      const room = io.sockets.adapter.rooms.get(roomId);
      return room ? room.size : 0;
    };

    socket.on("join", async (noteId: string, ack?: (ok: boolean, msg?: string) => void) => {
      try {
        if (!isValidObjectId(noteId)) {
          socket.emit("socket-error", { message: "Invalid note id." });
          ack?.(false, "Invalid note id.");
          return;
        }
        if (socket.data.currentNoteId && socket.data.currentNoteId !== noteId) {
          const prev = socket.data.currentNoteId;
          socket.leave(prev);
          socket.to(prev).emit("peer-left", { noteId: prev, count: roomSize(prev) });
        }
        socket.join(noteId);
        socket.data.currentNoteId = noteId;
        const note = await Note.findById(noteId).lean();
        if (note) {
          socket.emit("load-note", { html: note.html, title: note.title });
          socket.to(noteId).emit("peer-joined", { noteId, count: roomSize(noteId) });
          ack?.(true);
        } else {
          ack?.(false, "Note not found.");
          socket.emit("socket-error", { message: "Note not found." });
        }
      } catch {
        ack?.(false, "Failed to join note.");
        socket.emit("socket-error", { message: "Failed to join note." });
      }
    });

    socket.on(
      "edit",
      async ({ id, html, title }: { id: string; html: string; title: string }) => {
        try {
          if (!isValidObjectId(id)) {
            socket.emit("socket-error", { message: "Invalid note id." });
            return;
          }
          await Note.findByIdAndUpdate(
            id,
            { html, title, updatedAt: new Date() },
            { new: false }
          );
          socket.to(id).emit("update", { html, title });
        } catch {
          socket.emit("socket-error", { message: "Failed to save changes." });
        }
      }
    );

    socket.on(
      "leave",
      (noteId?: string, ack?: (ok: boolean, msg?: string) => void) => {
        const current = socket.data.currentNoteId;
        const target = noteId ?? current;

        if (!target) {
          ack?.(false, "Not in any note room.");
          return;
        }
        const rooms = socket.rooms;
        if (!rooms.has(target)) {
          ack?.(false, "Not joined in that room.");
          return;
        }
        socket.leave(target);
        if (current === target) socket.data.currentNoteId = null;
        socket.to(target).emit("peer-left", { noteId: target, count: roomSize(target) });
        ack?.(true);
      }
    );
    socket.on("disconnecting", () => {
      const current = socket.data.currentNoteId;
      if (current) {
        socket.to(current).emit("peer-left", { noteId: current, count: roomSize(current) - 1 });
      }
    });
  });
}
