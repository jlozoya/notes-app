import { Router } from "express";
import { Note } from "../models/Note";
import { auth, AuthRequest } from "../middleware/auth";

const router = Router();

router.use(auth);

// CREATE
router.post("/", async (req: AuthRequest, res) => {
  const note = new Note({ ...req.body, user: req.userId });
  await note.save();
  res.json(note);
});

// READ ALL
router.get("/", async (req: AuthRequest, res) => {
  const notes = await Note.find({ user: req.userId }).sort({ updatedAt: -1 });
  res.json(notes);
});

// READ ONE
router.get("/:id", async (req: AuthRequest, res) => {
  const note = await Note.findOne({ _id: req.params.id, user: req.userId });
  if (!note) return res.status(404).json({ message: "Not found" });
  res.json(note);
});

// UPDATE
router.put("/:id", async (req: AuthRequest, res) => {
  const note = await Note.findOneAndUpdate(
    { _id: req.params.id, user: req.userId },
    req.body,
    { new: true }
  );
  res.json(note);
});

// DELETE
router.delete("/:id", async (req: AuthRequest, res) => {
  await Note.deleteOne({ _id: req.params.id, user: req.userId });
  res.json({ success: true });
});

export default router;
