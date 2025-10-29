import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { IUser, User } from "../models/User";
import { sendEmail } from "../lib/mailer";
import { AuthRequest } from "../middleware/auth";
import { Note } from "../models/Note";
import {
  badRequest,
  generateTokenPair,
  isValidEmail,
  normalizeEmail,
  signToken,
  validatePassword,
} from "../lib/auth";
import { DeletionRequest } from "../models/DeletionRequest";

const router = Router();
const APP_URL = process.env.APP_URL || "https://notesapp.lozoya.org";

function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const hdr = req.headers.authorization || "";
    const [scheme, token] = hdr.split(" ");
    if (scheme !== "Bearer" || !token) {
      return res.status(401).json({ message: "Missing or invalid Authorization header" });
    }
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET not configured");
    const payload = jwt.verify(token, secret) as { id: string; iat: number; exp: number };
    req.userId = payload.id;
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

router.get("/me", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const user: IUser | null = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json({
      user: { id: user._id, email: user.email, emailVerified: user.emailVerified === true },
    });
  } catch (err) {
    console.error("Get me error:", err);
    return res.status(500).json({ message: "Failed to load profile" });
  }
});

router.delete("/me", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });

    const user: IUser | null = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    await Promise.all([
      Note.deleteMany({ user: req.userId }),
    ]);

    await user.deleteOne();
    return res.status(200).json({ message: "Account permanently deleted" });
  } catch (error) {
    console.error("Delete account error:", error);
    return res.status(500).json({ message: "Failed to delete account" });
  }
});

router.post("/update-email", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const newEmailRaw = req.body?.email ?? "";
    const newEmail = normalizeEmail(newEmailRaw);
    if (!newEmail) return badRequest(res, "Email is required");
    if (!isValidEmail(newEmail)) return badRequest(res, "Invalid email format");

    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const user: IUser | null = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.email.toLowerCase() === newEmail) {
      return res.json({
        message: "Email is unchanged",
        user: { id: user._id, email: user.email, emailVerified: user.emailVerified === true },
      });
    }

    const existing = await User.findOne({ email: newEmail }).lean();
    if (existing) return res.status(409).json({ message: "Email is already in use" });

    const { token, tokenHash } = generateTokenPair();
    user.email = newEmail;
    user.emailVerified = false;
    user.emailVerifyTokenHash = tokenHash;
    user.emailVerifyExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    const verifyUrl = `${APP_URL}/api/auth/verify-email?token=${token}&id=${user._id}&redirect=1`;
    await sendEmail({
      to: user.email,
      subject: "Verify your new email",
      template: {
        title: "Verify your email",
        intro: "Please verify your new email by clicking the button below:",
        ctaText: "Verify Email",
        ctaUrl: verifyUrl,
        expiresText: "This link expires in 24 hours.",
      },
    });

    return res.json({
      message: "Email updated. Verification sent to your new address.",
      user: { id: user._id, email: user.email, emailVerified: false },
    });
  } catch (error) {
    console.error("Update email error:", error);
    return res.status(500).json({ message: "Failed to update email" });
  }
});

router.post("/change-password", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body ?? {};
    if (!currentPassword || !newPassword) {
      return badRequest(res, "Current password and new password are required");
    }
    if (!validatePassword(newPassword)) {
      return badRequest(
        res,
        "Password must be at least 8 characters and include at least 1 letter and 1 number"
      );
    }

    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const user: IUser | null = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const ok = await user.comparePassword(currentPassword);
    if (!ok) return res.status(401).json({ message: "Current password is incorrect" });

    if (currentPassword === newPassword) {
      return badRequest(res, "New password must be different from current password");
    }

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetTokenExp = undefined;
    await user.save();

    const jwtToken = signToken(String(user._id));

    return res.json({
      message: "Password updated",
      token: jwtToken,
      user: { id: user._id, email: user.email },
    });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ message: "Failed to change password" });
  }
});

router.post("/delete-request", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ ok: false, message: "Unauthorized" });
    }

    const { reason } = (req.body || {}) as { reason?: string };
    const user = await User.findById(req.userId).lean();
    if (!user) return res.status(404).json({ ok: false, message: "User not found" });

    let reqDoc = await DeletionRequest.findOne({ userId: req.userId });
    if (!reqDoc) {
      const token = crypto.randomBytes(32).toString("hex");
      reqDoc = await DeletionRequest.create({
        userId: req.userId,
        email: user.email,
        reason,
        token,
        status: "pending",
      });
    }

    const baseUrl = process.env.PUBLIC_WEB_URL ?? APP_URL;
    const deleteUrl = `${baseUrl}/api/user/delete/verify?token=${encodeURIComponent(reqDoc.token)}`;

    await sendEmail({
      to: user.email,
      subject: "Confirm deletion request",
      template: {
        title: "Confirm deletion request",
        intro: "Confirm deletion request by clicking the button below:",
        ctaText: "Delete Account",
        ctaUrl: deleteUrl,
      },
    });

    return res.json({
      ok: true,
      message: "Deletion request created. Check your email to verify.",
      deleteUrl,
    });
  } catch (err) {
    console.error("Create deletion request error:", err);
    return res.status(500).json({ ok: false, message: "Failed to create deletion request" });
  }
});

router.get("/delete/verify", async (req: Request, res: Response) => {
  try {
    const { token, redirect } = req.query as { token?: string; redirect?: string };
    if (!token) return res.status(400).json({ ok: false, message: "Missing token." });

    const reqDoc = await DeletionRequest.findOne({ token });
    if (!reqDoc) return res.status(400).json({ ok: false, message: "Invalid token." });

    if (reqDoc.status !== "verified") {
      reqDoc.status = "verified";
      reqDoc.verifiedAt = new Date();
      await reqDoc.save();
    }

    if (redirect === "1") {
      return res.redirect(`${APP_URL}/login`);
    }

    return res.json({
      ok: true,
      message: "Deletion request verified. An admin/job will complete deletion shortly.",
    });
  } catch (err) {
    console.error("Verify deletion request error:", err);
    return res.status(500).json({ ok: false, message: "Failed to verify deletion request" });
  }
});

export default router;
