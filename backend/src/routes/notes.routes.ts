import { Router } from "express";
import mongoose, { Types } from "mongoose";
import crypto from "crypto";
import { Note } from "../models/Note";
import { auth, AuthRequest } from "../middleware/auth";

const router = Router();

router.use(auth);

const isValidObjectId = (id: string) =>
  typeof id === "string" &&
  mongoose.Types.ObjectId.isValid(id) &&
  new mongoose.Types.ObjectId(id).toString() === id;

function pickNoteFields(body: any) {
  return {
    title: typeof body?.title === "string" ? body.title : "Untitled",
    html: typeof body?.html === "string" ? body.html : "",
  };
}

const isOwner = (note: any, userId?: string) =>
  !!userId && note.user?.toString?.() === userId;

const isSharedWith = (note: any, userId?: string) =>
  !!userId &&
  Array.isArray(note.sharedWith) &&
  note.sharedWith.some((u: any) => u?.toString?.() === userId);

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

router.post("/:id/share/public", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { enable } = req.body as { enable: boolean };
    if (!isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });

    const note = await Note.findById(id);
    if (!note) return res.status(404).json({ message: "Not found" });
    if (!isOwner(note, req.userId)) return res.status(403).json({ message: "You cannot share notes from other users" });

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

router.post("/:id/share/invite", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body as { userId: string };
    if (!isValidObjectId(id) || !isValidObjectId(userId))
      return res.status(400).json({ message: "Invalid id" });

    const note = await Note.findById(id);
    if (!note) return res.status(404).json({ message: "Not found" });
    if (!isOwner(note, req.userId)) return res.status(403).json({ message: "You cannot share notes from other users" });

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

router.post("/:id/share/revoke", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body as { userId?: string };
    if (!isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });

    const note = await Note.findById(id);
    if (!note) return res.status(404).json({ message: "Not found" });
    if (!isOwner(note, req.userId)) return res.status(403).json({ message: "You cannot share notes from other users" });

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
