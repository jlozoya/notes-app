/**
 * User Routes (Profile, Account Management & Deletion Flow)
 * ---------------------------------------------------------
 * Endpoints for authenticated user profile retrieval, account deletion, email change,
 * password change, and a token-based self-service account deletion request/verification flow.
 *
 * Middlewares & Utilities
 * - `requireAuth` (local): Minimal Bearer JWT validator for endpoints below.
 * - `deleteRequestLimiter`: Rate limits public deletion requests to mitigate abuse.
 *
 * Environment
 * - APP_URL: Public base URL for building verification links (default: https://notesapp.lozoya.org)
 *
 * Endpoints
 * - GET    /me                 → Get current user profile
 * - DELETE /me                 → Permanently delete current user (and owned notes)
 * - POST   /update-email       → Update email and send verification link
 * - POST   /change-password    → Change password (current → new)
 * - GET    /delete-request     → Public: request account deletion email (rate limited)
 * - GET    /delete-verify      → Public: verify deletion request token (optionally redirect)
 *
 * Response Conventions
 * - 401 Unauthorized  → missing/invalid auth
 * - 404 Not Found     → user doc not found
 * - 409 Conflict      → email already in use (update-email)
 * - 400 Bad Request   → validation errors, missing params
 * - 5xx Server Error  → unexpected failures
 */

import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { IUser, User } from "../models/User";
import { sendEmail } from "../lib/mailer";
import { AuthRequest } from "../middleware/auth";
import { Note } from "../models/Note";
import {
  badRequest,
  generateTokenPair,
  hashToken,
  isValidEmail,
  normalizeEmail,
  signToken,
  validatePassword,
} from "../lib/auth";
import { DeletionRequest } from "../models/DeletionRequest";
import { deleteRequestLimiter } from "../middleware/rateLimit";
import mongoose, { isValidObjectId } from "mongoose";

const router = Router();

/** Public app URL used in email CTA links. */
const APP_URL = process.env.APP_URL || "https://notesapp.lozoya.org";

/**
 * requireAuth
 * -----------
 * Minimal Bearer JWT validator for routes that require the authenticated user.
 *
 * Behavior
 * - Expects `Authorization: Bearer <jwt>` header.
 * - Verifies token with `JWT_SECRET`.
 * - On success, attaches `req.userId` (payload.id) and calls `next()`.
 * - On failure, returns 401 with a generic error message.
 *
 * Notes
 * - This middleware is intentionally local and independent of the general `auth` middleware.
 * - Keep error messages generic to avoid revealing token internals.
 *
 * @param req Express request (augmented with `userId` on success)
 * @param res Express response
 * @param next Next middleware
 */
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

/**
 * GET /me
 * -------
 * Returns the authenticated user’s profile.
 *
 * Auth: Bearer token required.
 *
 * Success
 * - 200: { user: { id, email, emailVerified } }
 *
 * Errors
 * - 401: Unauthorized (no/invalid token)
 * - 404: User not found
 * - 500: Failed to load profile
 */
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

/**
 * DELETE /me
 * ----------
 * Permanently deletes the authenticated user and their owned notes.
 *
 * Auth: Bearer token required.
 *
 * Success
 * - 200: { message: "Account permanently deleted" }
 *
 * Errors
 * - 401: Unauthorized
 * - 404: User not found
 * - 500: Failed to delete account
 *
 * Notes
 * - Consider also deleting/cleaning any other data tied to the user (files, sessions, etc.).
 */
router.delete("/me", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });

    const user: IUser | null = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    await Promise.all([
      // Delete notes owned by the user. Shared notes owned by others remain untouched.
      Note.deleteMany({ user: req.userId }),
    ]);

    await user.deleteOne();
    return res.status(200).json({ message: "Account permanently deleted" });
  } catch (error) {
    console.error("Delete account error:", error);
    return res.status(500).json({ message: "Failed to delete account" });
  }
});

/**
 * POST /update-email
 * ------------------
 * Updates the authenticated user’s email and sends a new verification link
 * (24-hour expiration). Marks the account as unverified until confirmation.
 *
 * Auth: Bearer token required.
 *
 * Body
 * - email: string (required; valid format, normalized)
 *
 * Success
 * - 200: { message, user: { id, email, emailVerified: false } }
 * - 200 (unchanged): { message: "Email is unchanged", user: {...} }
 *
 * Errors
 * - 400: Invalid/missing email
 * - 401: Unauthorized
 * - 404: User not found
 * - 409: Email already in use
 * - 500: Failed to update email
 */
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

/**
 * POST /change-password
 * ---------------------
 * Changes the password for the authenticated user.
 * Requires the current password and a new password meeting policy requirements.
 * Clears any pending reset tokens, and returns a fresh JWT for immediate use.
 *
 * Auth: Bearer token required.
 *
 * Body
 * - currentPassword: string (required)
 * - newPassword: string (required; must pass `validatePassword`)
 *
 * Success
 * - 200: { message: "Password updated", token, user: { id, email } }
 *
 * Errors
 * - 400: Missing params / weak new password / new == current
 * - 401: Unauthorized / current password incorrect
 * - 404: User not found
 * - 500: Failed to change password
 */
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

/**
 * GET /delete-request
 * -------------------
 * Public endpoint to initiate an account deletion flow. If a user matching the provided
 * `email` or `userId` exists, upserts a `DeletionRequest` with a time-limited token and
 * sends a confirmation email. Always responds generically to prevent user enumeration.
 *
 * Rate Limited: `deleteRequestLimiter`
 *
 * Query
 * - email?:  string (normalized & validated if provided)
 * - userId?: string (ObjectId)
 *
 * Success
 * - 200: { ok: true, message: "If an account exists, we'll send instructions shortly." }
 *
 * Errors
 * - Always returns 200 with generic message on failure to avoid enumeration.
 */
router.get("/delete-request", deleteRequestLimiter, async (req: Request, res: Response) => {
  try {
    const { email: emailRaw, userId: userIdRaw } = req.query as { email?: string; userId?: string };

    const OK_MSG = "If an account exists, we'll send instructions shortly.";

    let user: { _id: mongoose.Types.ObjectId; email: string } | null = null;

    if (userIdRaw && isValidObjectId(userIdRaw)) {
      user = await User.findById(userIdRaw).select("_id email").lean();
    } else if (typeof emailRaw === "string" && emailRaw.trim()) {
      const email = normalizeEmail(emailRaw);
      if (email && isValidEmail(email)) {
        user = await User.findOne({ email }).select("_id email").lean();
      } else {
        return res.json({ ok: true, message: OK_MSG });
      }
    } else {
      return res.json({ ok: true, message: OK_MSG });
    }

    if (!user) {
      return res.json({ ok: true, message: OK_MSG });
    }

    // Token for verifying deletion request via link (hash persisted)
    const token = signToken(String(user._id));
    const tokenHash = hashToken(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h

    await DeletionRequest.findOneAndUpdate(
      { userId: user._id },
      {
        userId: user._id,
        email: user.email,
        reason: "Public request",
        tokenHash,
        status: "pending",
        requestedAt: now,
        verifiedAt: null,
        expiresAt,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const verifyUrl = `${APP_URL}/api/user/delete-verify?token=${encodeURIComponent(token)}`;

    await sendEmail({
      to: user.email,
      subject: "Confirm deletion request",
      template: {
        title: "Confirm deletion request",
        intro: "Confirm deletion of your account and data by clicking the button below.",
        ctaText: "Confirm Deletion",
        ctaUrl: verifyUrl,
        expiresText: "This link expires in 24 hours.",
      },
    });

    return res.json({ ok: true, message: OK_MSG });
  } catch (error) {
    console.error("Public deletion request error:", error);
    return res.json({
      ok: true,
      message: "If an account exists, we'll send instructions shortly.",
    });
  }
});

/**
 * GET /delete-verify
 * ------------------
 * Completes the first step of the deletion flow by verifying the request token.
 * Marks the stored `DeletionRequest` as `verified` (if not already). Optionally
 * redirects to a front-end route after successful verification.
 *
 * Query
 * - token:    string (required)
 * - redirect: string (optional; "1" → 302 to `${APP_URL}/login`)
 *
 * Success
 * - 302: Redirect to `${APP_URL}/login` (when `redirect=1`)
 * - 200: { ok: true, message }
 *
 * Errors
 * - 400: Missing token / invalid or expired token
 * - 500: Failed to verify deletion request
 *
 * Notes
 * - A background/admin process is expected to act on `verified` requests to perform
 *   irreversible deletion. This endpoint only verifies the intent.
 */
router.get("/delete-verify", async (req: Request, res: Response) => {
  try {
    const { token, redirect } = req.query as { token?: string; redirect?: string };
    if (!token) return res.status(400).json({ ok: false, message: "Missing token." });

    const tokenHash = hashToken(token);
    const reqDoc = await DeletionRequest.findOne({ tokenHash });

    if (!reqDoc) return res.status(400).json({ ok: false, message: "Invalid or expired token." });
    if (reqDoc.expiresAt && reqDoc.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ ok: false, message: "Invalid or expired token." });
    }

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
