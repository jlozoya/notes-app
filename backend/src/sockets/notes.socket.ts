import { Server, Socket } from "socket.io";
import mongoose, { Types } from "mongoose";
import { Note } from "../models/Note";
import { attachSocketAuth } from "./auth";

function isValidObjectId(id: any) {
  return typeof id === "string" &&
    mongoose.Types.ObjectId.isValid(id) &&
    new mongoose.Types.ObjectId(id).toString() === id;
}

function toIdString(v: any): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (v instanceof Types.ObjectId) return v.toString();
  if (typeof v.toHexString === "function") return v.toHexString();
  return null;
}

function canAccessNote(note: any, userId?: string, providedShareCode?: string) {
  if (note.isPublic) return true;
  if (providedShareCode && note.shareCode && providedShareCode === note.shareCode) return true;
  if (!userId) return false;

  const owner = toIdString(note.user);
  if (owner && owner === userId) return true;

  if (Array.isArray(note.sharedWith)) {
    for (const x of note.sharedWith) {
      const sid = toIdString(x);
      if (sid && sid === userId) return true;
    }
  }
  return false;
}

export function setupNoteSockets(io: Server) {
  io.use(attachSocketAuth(process.env.JWT_SECRET!));
  io.on("connection", (socket: Socket) => {
    socket.data.currentNoteId = null as string | null;

    socket.on(
      "join",
      async (
        noteId: string,
        opts: { shareCode?: string } | undefined,
        ack?: (ok: boolean, msg?: string) => void
      ) => {
        try {
          if (!isValidObjectId(noteId)) return ack?.(false, "Invalid note id.");
          const note = await Note.findById(noteId).lean();
          if (!note) return ack?.(false, "Note not found.");

          const allowed = canAccessNote(note, socket.data.userId, opts?.shareCode);
          if (!allowed) return ack?.(false, "Access denied.");

          if (socket.data.currentNoteId && socket.data.currentNoteId !== noteId) {
            const prev = socket.data.currentNoteId;
            socket.leave(prev);
            socket.to(prev).emit("peer-left", { noteId: prev });
          }

          socket.join(noteId);
          socket.data.currentNoteId = noteId;
          socket.emit("load-note", { html: note.html, title: note.title });
          socket.to(noteId).emit("peer-joined", { noteId });
          ack?.(true);
        } catch {
          ack?.(false, "Failed to join note.");
        }
      }
    );

    socket.on("edit", async ({ id, html, title }: { id: string; html: string; title: string }) => {
      try {
        if (!isValidObjectId(id)) return socket.emit("socket-error", { message: "Invalid note id." });

        const note = await Note.findById(id);
        if (!note) return socket.emit("socket-error", { message: "Note not found." });
        const allowed = canAccessNote(note, socket.data.userId, undefined);
        if (!allowed) return socket.emit("socket-error", { message: "Access denied." });

        await Note.findByIdAndUpdate(id, { html, title, updatedAt: new Date() }, { new: false });
        socket.to(id).emit("update", { html, title });
      } catch {
        socket.emit("socket-error", { message: "Failed to save changes." });
      }
    });

    socket.on("leave", (noteId?: string, ack?: (ok: boolean, msg?: string) => void) => {
      const target = noteId ?? socket.data.currentNoteId;
      if (!target) return ack?.(false, "Not in any note room.");
      if (!socket.rooms.has(target)) return ack?.(false, "Not joined in that room.");
      socket.leave(target);
      if (socket.data.currentNoteId === target) socket.data.currentNoteId = null;
      socket.to(target).emit("peer-left", { noteId: target });
      ack?.(true);
    });
  });
}
