import { Router } from "express";
import mongoose from "mongoose";
import { Note } from "../models/Note";
import { auth, AuthRequest } from "../middleware/auth";

const router = Router();

router.use(auth);

// ---- helpers ----
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

// ---- CREATE ----
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

// ---- READ ALL ----
router.get("/", async (req: AuthRequest, res) => {
  try {
    const notes = await Note.find({ user: req.userId }).sort({ updatedAt: -1 });
    res.json(notes);
  } catch (e: any) {
    res.status(500).json({ message: "Failed to fetch notes" });
  }
});

// ---- READ ONE ----
router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });

    const note = await Note.findOne({ _id: id, user: req.userId });
    if (!note) return res.status(404).json({ message: "Not found" });
    res.json(note);
  } catch (e: any) {
    res.status(500).json({ message: "Failed to fetch note" });
  }
});

// ---- UPDATE ----
router.put("/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });

    const payload = pickNoteFields(req.body);

    const note = await Note.findOneAndUpdate(
      { _id: id, user: req.userId },
      { ...payload, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!note) return res.status(404).json({ message: "Not found" });
    res.json(note);
  } catch (e: any) {
    res.status(400).json({ message: e?.message || "Failed to update note" });
  }
});

// ---- DELETE ----
router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });

    const result = await Note.deleteOne({ _id: id, user: req.userId });
    if (result.deletedCount === 0) return res.status(404).json({ message: "Not found" });

    res.json({ success: true });
  } catch (e: any) {
    res.status(400).json({ message: e?.message || "Failed to delete note" });
  }
});

export default router;
