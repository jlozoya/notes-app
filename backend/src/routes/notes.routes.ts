/**
 * Notes Routes (Express + Mongoose)
 * ---------------------------------
 * Authenticated CRUD and sharing endpoints for Note documents.
 *
 * All routes require authentication (`router.use(auth)`), and enforce authorization:
 * - Owners can read/update/delete their notes.
 * - Non-owners with access via `sharedWith` can read notes but not modify or share them.
 *
 * Endpoints
 * - POST   /                    Create a new note (owner-only; implicit current user)
 * - GET    /                    List notes I own or that were shared with me
 * - GET    /:id                 Fetch a single note (must be owner or shared-with)
 * - PUT    /:id                 Update a note (owner-only)
 * - DELETE /:id                 Delete a note (owner-only)
 * - POST   /:id/share/public    Toggle public sharing; assign a share code (owner-only)
 * - POST   /:id/share/invite    Grant access to another userId (owner-only)
 * - POST   /:id/share/revoke    Revoke access from a userId or disable public sharing (owner-only)
 *
 * Security & Validation
 * - `isValidObjectId`: Strictly validates MongoDB ObjectId strings.
 * - `pickNoteFields`: Whitelists updatable fields, providing safe defaults.
 * - Owner checks compare `note.user` to authenticated `req.userId`.
 * - Shared checks verify presence of `req.userId` in `note.sharedWith`.
 *
 * Responses
 * - Consistent 400 for invalid ids/body, 403 for forbidden, 404 for missing, 500 for server errors.
 */

import { Router } from "express";
import mongoose, { Types } from "mongoose";
import crypto from "crypto";
import { Note } from "../models/Note";
import { auth, AuthRequest } from "../middleware/auth";

const router = Router();

/** Require authenticated requests for all routes below. */
router.use(auth);

/**
 * Determines if a string is a canonical MongoDB ObjectId.
 * Uses Mongoose validation AND a normalized re-stringification check to avoid loose acceptance.
 *
 * @param id - The id string to validate.
 * @returns boolean - True if `id` is a valid ObjectId in canonical string form.
 */
const isValidObjectId = (id: string) =>
  typeof id === "string" &&
  mongoose.Types.ObjectId.isValid(id) &&
  new mongoose.Types.ObjectId(id).toString() === id;

/**
 * Picks and normalizes allowed note fields from the request body.
 * Provides server-side defaults to keep domain rules centralized.
 *
 * @param body - Arbitrary request body (untrusted).
 * @returns An object with safe `title` and `html` fields.
 */
function pickNoteFields(body: any) {
  return {
    title: typeof body?.title === "string" ? body.title : "Untitled",
    html: typeof body?.html === "string" ? body.html : "",
  };
}

/**
 * True if the authenticated user is the owner of the note.
 *
 * @param note - A Note document or lean object with `user` reference.
 * @param userId - Authenticated user id (string).
 */
const isOwner = (note: any, userId?: string) =>
  !!userId && note.user?.toString?.() === userId;

/**
 * True if the note is shared with the authenticated user.
 *
 * @param note - A Note document or lean object with `sharedWith` array.
 * @param userId - Authenticated user id (string).
 */
const isSharedWith = (note: any, userId?: string) =>
  !!userId &&
  Array.isArray(note.sharedWith) &&
  note.sharedWith.some((u: any) => u?.toString?.() === userId);

/**
 * POST /
 * ------
 * Create a new note owned by the authenticated user.
 *
 * Body:
 * - title?: string   (default "Untitled")
 * - html?: string    (default "")
 *
 * Returns:
 * - 200 OK with created note JSON.
 * - 400 on validation errors.
 */
router.post("/", async (req: AuthRequest, res) => {
  try {
    const payload = pickNoteFields(req.body);
    const note = new Note({ ...payload, user: req.userId });
    await note.save();
    res.json(note);
  } catch (e: any) {
    res.status(400).json({ message: e?.message || "Failed to create note" });
  }
});

/**
 * GET /
 * -----
 * List notes where I am the owner OR I am included in `sharedWith`.
 * Sorted by `updatedAt` descending to surface most-recent changes.
 *
 * Returns:
 * - 200 OK with an array of notes.
 * - 500 on server error.
 */
router.get("/", async (req: AuthRequest, res) => {
  try {
    const me = new Types.ObjectId(req.userId);
    const notes = await Note.find({
      $or: [{ user: me }, { sharedWith: me }],
    }).sort({ updatedAt: -1 });
    res.json(notes);
  } catch (e: any) {
    res.status(500).json({ message: "Failed to fetch notes" });
  }
});

/**
 * GET /:id
 * --------
 * Retrieve a single note by id. Allowed if:
 * - I am the owner, or
 * - The note is shared with me.
 *
 * Params:
 * - id: string (ObjectId)
 *
 * Returns:
 * - 200 OK with note JSON.
 * - 400 if invalid id.
 * - 404 if not found.
 * - 403 if user lacks access.
 * - 500 on server error.
 */
router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });

    const note = await Note.findById(id);
    if (!note) return res.status(404).json({ message: "Not found" });

    if (!(isOwner(note, req.userId) || isSharedWith(note, req.userId))) {
      return res.status(403).json({ message: "Forbidden" });
    }
    res.json(note);
  } catch (e: any) {
    res.status(500).json({ message: "Failed to fetch note" });
  }
});

/**
 * PUT /:id
 * --------
 * Update a note's content (title/html). Only the owner may update.
 * Automatically bumps `updatedAt`.
 *
 * Params:
 * - id: string (ObjectId)
 *
 * Body:
 * - title?: string
 * - html?: string
 *
 * Returns:
 * - 200 OK with updated note.
 * - 400 if invalid id/body.
 * - 404 if note not found.
 * - 403 if not owner.
 */
router.put("/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });

    const existing = await Note.findById(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!isOwner(existing, req.userId)) return res.status(403).json({ message: "Forbidden" });

    const payload = pickNoteFields(req.body);
    const note = await Note.findByIdAndUpdate(
      id,
      { ...payload, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    res.json(note);
  } catch (e: any) {
    res.status(400).json({ message: e?.message || "Failed to update note" });
  }
});

/**
 * DELETE /:id
 * -----------
 * Delete a note. Only the owner may delete.
 *
 * Params:
 * - id: string (ObjectId)
 *
 * Returns:
 * - 200 OK: { success: true }
 * - 400 if invalid id.
 * - 404 if not found.
 * - 403 if not owner.
 */
router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });

    const existing = await Note.findById(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (!isOwner(existing, req.userId)) return res.status(403).json({ message: "Forbidden" });

    await Note.deleteOne({ _id: id });
    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ message: e?.message || "Failed to delete note" });
  }
});

/**
 * POST /:id/share/public
 * ----------------------
 * Toggle public sharing for a note. Owner-only.
 *
 * Behavior:
 * - When enabling, generates a `shareCode` if not already set (random 8-byte hex).
 * - When disabling, leaves `shareCode` intact for potential re-enable (revoked in /revoke).
 *
 * Params:
 * - id: string (ObjectId)
 *
 * Body:
 * - enable: boolean
 *
 * Returns:
 * - 200 OK: { isPublic: boolean, shareCode?: string }
 * - 400/403/404 on errors.
 */
router.post("/:id/share/public", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { enable } = req.body as { enable: boolean };
    if (!isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });

    const note = await Note.findById(id);
    if (!note) return res.status(404).json({ message: "Not found" });
    if (!isOwner(note, req.userId)) {
      return res.status(403).json({ message: "You cannot share notes from other users" });
    }

    note.isPublic = !!enable;
    if (enable && !note.shareCode) {
      note.shareCode = crypto.randomBytes(8).toString("hex");
    }
    await note.save();
    res.json({ isPublic: note.isPublic, shareCode: note.shareCode });
  } catch (e: any) {
    res.status(400).json({ message: e?.message || "Failed to update sharing" });
  }
});

/**
 * POST /:id/share/invite
 * ----------------------
 * Grant access to another user for a given note. Owner-only.
 * Adds the userId to `sharedWith` if not already present.
 *
 * Params:
 * - id: string (ObjectId) - Note id
 *
 * Body:
 * - userId: string (ObjectId) - User to grant access to
 *
 * Returns:
 * - 200 OK: { ok: true }
 * - 400 if invalid ids.
 * - 404 if note not found.
 * - 403 if not owner.
 */
router.post("/:id/share/invite", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body as { userId: string };
    if (!isValidObjectId(id) || !isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const note = await Note.findById(id);
    if (!note) return res.status(404).json({ message: "Not found" });
    if (!isOwner(note, req.userId)) {
      return res.status(403).json({ message: "You cannot share notes from other users" });
    }

    const uid = new Types.ObjectId(userId);
    if (!Array.isArray(note.sharedWith)) note.sharedWith = [];
    if (!note.sharedWith.some((u: any) => u?.toString?.() === uid.toString())) {
      note.sharedWith.push(uid as any);
      await note.save();
    }
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ message: e?.message || "Failed to invite user" });
  }
});

/**
 * POST /:id/share/revoke
 * ----------------------
 * Revoke access to a note. Owner-only.
 *
 * Behavior:
 * - If `userId` is provided: remove that user from `sharedWith`.
 * - If `userId` is not provided: disable public sharing and clear `shareCode`.
 *
 * Params:
 * - id: string (ObjectId)
 *
 * Body:
 * - userId?: string (ObjectId)
 *
 * Returns:
 * - 200 OK: { ok: true }
 * - 400/403/404 on errors.
 */
router.post("/:id/share/revoke", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body as { userId?: string };
    if (!isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });

    const note = await Note.findById(id);
    if (!note) return res.status(404).json({ message: "Not found" });
    if (!isOwner(note, req.userId)) {
      return res.status(403).json({ message: "You cannot share notes from other users" });
    }

    if (userId) {
      if (!isValidObjectId(userId)) return res.status(400).json({ message: "Invalid user id" });
      note.sharedWith = (note.sharedWith || []).filter(
        (u: any) => u?.toString?.() !== userId
      );
    } else {
      note.isPublic = false;
      note.shareCode = undefined as any;
    }
    await note.save();
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ message: e?.message || "Failed to revoke" });
  }
});

export default router;
