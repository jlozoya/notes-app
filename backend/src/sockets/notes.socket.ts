/**
 * Note Sockets (Socket.IO + Mongoose)
 * -----------------------------------
 * Real-time collaboration channel for Notes.
 *
 * Responsibilities
 * - Authenticates sockets via JWT (`attachSocketAuth`) and attaches `socket.data.userId`.
 * - Room membership per note (`join`, `leave`) with access control:
 *   - Owner, shared users, or anyone with valid `shareCode`.
 *   - Public notes (`isPublic`) are readable/editable by anyone connected.
 * - Broadcasts state:
 *   - `load-note` to joining socket with current note payload.
 *   - `peer-joined` / `peer-left` to others in the room.
 *   - `update` to peers after edits.
 *
 * Events (Client → Server)
 * - `join(noteId, { shareCode? }, ack)` → Join note room after ACL check; returns `ok:boolean`.
 * - `edit({ id, html, title })` → Persist changes and broadcast to peers.
 * - `leave(noteId?, ack)` → Leave current or specified note room.
 *
 * Events (Server → Client)
 * - `load-note: { html, title }`
 * - `update:    { html, title }`
 * - `peer-joined: { noteId }`
 * - `peer-left:   { noteId }`
 * - `socket-error: { message }`
 */

import { Server, Socket } from "socket.io";
import mongoose, { Types } from "mongoose";
import { Note } from "../models/Note";
import { attachSocketAuth } from "./auth";

/**
 * Strict ObjectId validator.
 * Validates structure and ensures canonical string form by round-tripping.
 *
 * @param id - Candidate id value.
 * @returns `true` if `id` is a canonical MongoDB ObjectId string.
 */
function isValidObjectId(id: any) {
  return (
    typeof id === "string" &&
    mongoose.Types.ObjectId.isValid(id) &&
    new mongoose.Types.ObjectId(id).toString() === id
  );
}

/**
 * Normalizes various id-like values to a string.
 * Accepts ObjectId instances or any object exposing `toHexString()`.
 *
 * @param v - Value to normalize.
 * @returns The stringified id, or `null` if it cannot be derived.
 */
function toIdString(v: any): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (v instanceof Types.ObjectId) return v.toString();
  if (typeof v.toHexString === "function") return v.toHexString();
  return null;
}

/**
 * Access control for a note.
 * Allows access when:
 * - `note.isPublic` is true, OR
 * - Provided `shareCode` matches, OR
 * - `userId` is the owner, OR
 * - `userId` is present in `note.sharedWith`.
 *
 * @param note - Note document (lean or hydrated).
 * @param userId - Authenticated user id (from `socket.data.userId`).
 * @param providedShareCode - Optional share code supplied by the client on join.
 * @returns `true` if access is allowed, else `false`.
 */
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

/**
 * Initializes all Socket.IO handlers for note collaboration.
 *
 * Middleware
 * - Uses `attachSocketAuth(JWT_SECRET)` to authenticate connections; sets `socket.data.userId`.
 *
 * Connection lifecycle
 * - On connect: initializes `socket.data.currentNoteId`.
 * - On disconnect: room membership is automatically cleaned up by Socket.IO;
 *   peers receive `peer-left` only on explicit `leave` event here.
 *
 * Events
 * - `join(noteId, { shareCode? }, ack)`:
 *    Validates id and ACL, updates room membership, sends `load-note` to caller, and `peer-joined` to others.
 * - `edit({ id, html, title })`:
 *    Validates id and ACL, persists note changes, emits `update` to peers (not echo to self).
 * - `leave(noteId?, ack)`:
 *    Leaves the specified or current room, emits `peer-left` to peers.
 *
 * Error semantics
 * - Uses `ack(false, message)` where available for join/leave failures.
 * - Emits `socket-error` with a user-facing message for edit failures and invalid states.
 *
 * @param io - Socket.IO server instance.
 */
export function setupNoteSockets(io: Server) {
  // Attach per-socket JWT auth; throws if secret is missing.
  io.use(attachSocketAuth(process.env.JWT_SECRET!));

  io.on("connection", (socket: Socket) => {
    /** The note room this socket is currently joined to (if any). */
    socket.data.currentNoteId = null as string | null;

    /**
     * Join a note room after validation and ACL checks.
     *
     * @event join
     * @param noteId - Note ObjectId string.
     * @param opts   - Optional `{ shareCode?: string }` for public link access.
     * @param ack    - Acknowledgement callback `(ok, msg?)`.
     *
     * Success path:
     * - Leaves previous note room (if different) and notifies peers via `peer-left`.
     * - Joins `noteId` room, sets `currentNoteId`.
     * - Emits `load-note` to self with `{ html, title }`.
     * - Notifies peers in room via `peer-joined`.
     */
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

          // If moving between rooms, leave previous + notify peers.
          if (socket.data.currentNoteId && socket.data.currentNoteId !== noteId) {
            const prev = socket.data.currentNoteId;
            socket.leave(prev);
            socket.to(prev).emit("peer-left", { noteId: prev });
          }

          socket.join(noteId);
          socket.data.currentNoteId = noteId;

          // Send initial payload to the joining client only.
          socket.emit("load-note", { html: note.html, title: note.title });

          // Notify existing peers that someone joined.
          socket.to(noteId).emit("peer-joined", { noteId });

          ack?.(true);
        } catch {
          ack?.(false, "Failed to join note.");
        }
      }
    );

    /**
     * Persist and broadcast edits for the current note.
     *
     * @event edit
     * @param payload - `{ id, html, title }`
     *                  - `id` must be a valid ObjectId and pass ACL checks.
     *
     * Behavior
     * - Validates note existence and ACL for the authoring socket.
     * - Updates `html`, `title`, and `updatedAt`.
     * - Emits `update` with `{ html, title }` to all peers in the room (excludes sender).
     *
     * Errors
     * - Emits `socket-error` for invalid id, missing note, access denied, or persistence failures.
     */
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

    /**
     * Leave the active or specified note room.
     *
     * @event leave
     * @param noteId - Optional target room. Defaults to `socket.data.currentNoteId`.
     * @param ack    - Acknowledgement callback `(ok, msg?)`.
     *
     * Behavior
     * - If not joined, acknowledges with an error message.
     * - Leaves the room, clears `currentNoteId` if applicable.
     * - Notifies peers via `peer-left`.
     */
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
