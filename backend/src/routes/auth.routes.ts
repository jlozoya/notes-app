import { Router } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User";

const router = Router();

function signToken(userId: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not configured");
  return jwt.sign({ id: userId }, secret, { expiresIn: "7d" });
}

router.post("/signup", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const exists = await User.findOne({ email }).lean();
    if (exists) {
      return res.status(409).json({ message: "User already exists" });
    }

    const user = new User({ email, password });
    await user.save();

    const token = signToken(String(user._id));
    return res.json({ token, user: { id: user._id, email: user.email } });
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "User already exists" });
    }
    console.error("Signup error:", error);
    return res.status(500).json({ message: "Failed to sign up" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = signToken(String(user._id));
    return res.json({ token, user: { id: user._id, email: user.email } });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Failed to log in" });
  }
});

export default router;
