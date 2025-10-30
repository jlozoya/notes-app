/**
 * Auth Routes (Express + Mongoose)
 * --------------------------------
 * Endpoints for user authentication and account lifecycle:
 * - POST   /signup                Create account, send email verification
 * - GET    /verify-email          Verify email via link (optional redirect)
 * - POST   /verify-email          Verify email via API (no redirect)
 * - POST   /resend-verification   Resend email verification link
 * - POST   /login                 Authenticate user with email/password
 * - POST   /forgot-password       Issue password reset token + email
 * - POST   /reset-password        Reset password using token
 *
 * Security & UX Notes
 * - Email normalization & format validation on input.
 * - Strong password policy enforced by `validatePassword()`.
 * - Token pairs are generated server-side; only the hash is stored in DB.
 * - Email verification + reset tokens have expirations (24h / 1h).
 * - Login blocked for unverified accounts (HTTP 403).
 * - Generic responses for privacy (e.g., “If an account exists…”).
 *
 * Environment
 * - APP_URL (string): Public base URL for verification/reset links
 *   Fallback: "https://notesapp.lozoya.org"
 */

import { Router, Request, Response } from "express";
import { IUser, User } from "../models/User";
import { sendEmail } from "../lib/mailer";
import {
  badRequest,
  created,
  generateTokenPair,
  hashToken,
  isValidEmail,
  normalizeEmail,
  signToken,
  validatePassword,
} from "../lib/auth";

const router = Router();

/**
 * Public application URL used to build CTA links sent by email.
 * e.g. https://yourapp.com
 */
const APP_URL = process.env.APP_URL || "https://notesapp.lozoya.org";

/**
 * POST /signup
 * ------------
 * Creates a new user, sends an email verification link valid for 24 hours.
 *
 * Body:
 * - email    (string, required)
 * - password (string, required; validated by `validatePassword`)
 *
 * Responses:
 * - 201 Created: { message }
 * - 400 Bad Request: { message }
 * - 409 Conflict: { message: "User already exists" }
 * - 500 Server Error
 */
router.post("/signup", async (req: Request, res: Response) => {
  try {
    const emailRaw = req.body?.email ?? "";
    const password = req.body?.password ?? "";
    const email = normalizeEmail(emailRaw);

    if (!email || !password) return badRequest(res, "Email and password are required");
    if (!isValidEmail(email)) return badRequest(res, "Invalid email format");
    if (!validatePassword(password)) {
      return badRequest(
        res,
        "Password must be at least 8 characters and include at least 1 letter and 1 number"
      );
    }

    // Ensure uniqueness by email
    const exists = await User.findOne({ email }).lean();
    if (exists) return res.status(409).json({ message: "User already exists" });

    // Generate verification token pair: token sent via email, hash stored in DB
    const { token, tokenHash } = generateTokenPair();
    const emailVerifyExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const user: IUser = new User({
      email,
      password,
      emailVerified: false,
      emailVerifyTokenHash: tokenHash,
      emailVerifyExpiresAt,
    });
    await user.save();

    // Build verification link with redirect
    const verifyUrl = `${APP_URL}/api/auth/verify-email?token=${token}&id=${user._id}&redirect=1`;
    await sendEmail({
      to: user.email,
      subject: "Verify your email",
      template: {
        title: "Verify your email",
        intro: "Please verify your email by clicking the button below:",
        ctaText: "Verify Email",
        ctaUrl: verifyUrl,
        expiresText: "This link expires in 24 hours.",
      },
    });

    return created(res, {
      message: "Account created. Please check your email to verify your account.",
    });
  } catch (error: any) {
    // Duplicate key (unique index) safe-guard
    if (error?.code === 11000) {
      return res.status(409).json({ message: "User already exists" });
    }
    console.error("Signup error:", error);
    return res.status(500).json({ message: "Failed to sign up" });
  }
});

/**
 * GET /verify-email
 * -----------------
 * Verifies the user's email using the token & id provided in the link.
 * Optionally redirects to a front-end route with a signed JWT for immediate auth.
 *
 * Query:
 * - token    (string, required)
 * - id       (string, required; user id)
 * - redirect (string, optional; "1" to redirect with JWT)
 *
 * Responses:
 * - 302 Redirect (when redirect=1): to `${APP_URL}/verify?verified=1&token=...`
 * - 200 OK: { message, token, user }
 * - 400 Bad Request: { message }
 * - 500 Server Error
 */
router.get("/verify-email", async (req: Request, res: Response) => {
  try {
    const { token, id, redirect } = req.query as { token?: string; id?: string; redirect?: string };
    if (!token || !id) return res.status(400).json({ message: "Token and id are required" });

    // Find user with matching hashed token that hasn't expired
    const user = await User.findOne({
      _id: id,
      emailVerifyTokenHash: hashToken(token),
      emailVerifyExpiresAt: { $gt: new Date() },
    });

    if (!user) return res.status(400).json({ message: "Invalid or expired token" });

    // Mark verified, clear token data
    user.emailVerified = true;
    user.emailVerifyTokenHash = undefined;
    user.emailVerifyExpiresAt = undefined;
    await user.save();

    // Sign short JWT to allow immediate client login post verification
    const jwtToken = signToken(String(user._id));

    if (redirect === "1") {
      return res.redirect(
        `${APP_URL}/verify?verified=1&token=${jwtToken}&id=${user._id}&email=${encodeURIComponent(
          user.email
        )}`
      );
    }

    return res.json({
      message: "Email verified",
      token: jwtToken,
      user: { id: user._id, email: user.email },
    });
  } catch (error) {
    console.error("Verify email (GET) error:", error);
    return res.status(500).json({ message: "Failed to verify email" });
  }
});

/**
 * POST /verify-email
 * ------------------
 * Programmatic email verification without redirect.
 *
 * Body:
 * - token (string, required)
 * - id    (string, required; user id)
 *
 * Responses:
 * - 200 OK: { message, token, user }
 * - 400 Bad Request / Invalid Token: { message }
 * - 500 Server Error
 */
router.post("/verify-email", async (req: Request, res: Response) => {
  try {
    const { token, id } = req.body ?? {};
    if (!token || !id) return badRequest(res, "Token and id are required");

    const user: IUser | null = await User.findOne({
      _id: id,
      emailVerifyTokenHash: hashToken(token),
      emailVerifyExpiresAt: { $gt: new Date() },
    });

    if (!user) return res.status(400).json({ message: "Invalid or expired token" });

    user.emailVerified = true;
    user.emailVerifyTokenHash = undefined;
    user.emailVerifyExpiresAt = undefined;
    await user.save();

    const jwtToken = signToken(String(user._id));
    return res.json({
      message: "Email verified",
      token: jwtToken,
      user: { id: user._id, email: user.email },
    });
  } catch (error) {
    console.error("Verify email error:", error);
    return res.status(500).json({ message: "Failed to verify email" });
  }
});

/**
 * POST /resend-verification
 * -------------------------
 * Resends the email verification link if the account exists and is not verified.
 * Returns generic messaging to avoid email enumeration issues.
 *
 * Body:
 * - email (string, required)
 *
 * Responses:
 * - 200 OK: { message }
 * - 400 Bad Request: { message }
 * - 500 Server Error
 */
router.post("/resend-verification", async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body?.email ?? "");
    if (!email) return badRequest(res, "Email is required");
    if (!isValidEmail(email)) return badRequest(res, "Invalid email format");

    const user: IUser | null = await User.findOne({ email });
    if (!user) {
      // Do not reveal whether the user exists
      return res.json({ message: "If an account exists, a verification email has been sent" });
    }
    if (user.emailVerified) {
      return res.json({ message: "Account already verified" });
    }

    const { token, tokenHash } = generateTokenPair();
    user.emailVerifyTokenHash = tokenHash;
    user.emailVerifyExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    const verifyUrl = `${APP_URL}/api/auth/verify-email?token=${token}&id=${user._id}&redirect=1`;
    await sendEmail({
      to: user.email,
      subject: "Verify your email",
      template: {
        title: "Verify your email",
        intro: "Verify your email by clicking the button below:",
        ctaText: "Verify Email",
        ctaUrl: verifyUrl,
        expiresText: "This link expires in 24 hours.",
      },
    });

    return res.json({ message: "Verification email sent (if account exists)" });
  } catch (error) {
    console.error("Resend verification error:", error);
    return res.status(500).json({ message: "Failed to resend verification email" });
  }
});

/**
 * POST /login
 * -----------
 * Authenticates a user with email + password. Requires prior email verification.
 *
 * Body:
 * - email    (string, required)
 * - password (string, required)
 *
 * Responses:
 * - 200 OK: { token, user }
 * - 401 Unauthorized: { message: "Invalid credentials" }
 * - 403 Forbidden: { message: "Please verify your email before logging in" }
 * - 400/500 on errors
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body?.email ?? "");
    const password = req.body?.password ?? "";
    if (!email || !password) return badRequest(res, "Email and password are required");

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (!user.emailVerified) {
      return res.status(403).json({ message: "Please verify your email before logging in" });
    }

    const token = signToken(String(user._id));
    return res.json({ token, user: { id: user._id, email: user.email } });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Failed to log in" });
  }
});

/**
 * POST /forgot-password
 * ---------------------
 * Issues a password reset token (valid for 1 hour) and emails a reset link.
 * Responds generically for privacy whether the account exists or not.
 *
 * Body:
 * - email (string, required)
 *
 * Responses:
 * - 200 OK: { message: "If an account exists, a reset link has been sent" }
 * - 400 Bad Request: { message }
 * - 500 Server Error
 */
router.post("/forgot-password", async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body?.email ?? "");
    if (!email) return badRequest(res, "Email is required");
    if (!isValidEmail(email)) return badRequest(res, "Invalid email format");

    const user: IUser | null = await User.findOne({ email });

    // Always respond generically
    if (!user) return res.json({ message: "If an account exists, a reset link has been sent" });

    const { token, tokenHash } = generateTokenPair();
    user.passwordResetToken = tokenHash;
    user.passwordResetTokenExp = new Date(Date.now() + 60 * 60 * 1000); // 1h
    await user.save();

    const resetUrl = `${APP_URL}/reset?token=${token}&id=${user._id}`;
    await sendEmail({
      to: user.email,
      subject: "Reset your password",
      template: {
        title: "Reset your password",
        intro: "You requested a password reset.",
        ctaText: "Reset Password",
        ctaUrl: resetUrl,
        expiresText:
          "This link expires in 1 hour. If you did not request this, you can ignore this email.",
      },
    });

    return res.json({ message: "If an account exists, a reset link has been sent" });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ message: "Failed to process request" });
  }
});

/**
 * POST /reset-password
 * --------------------
 * Resets the user's password using a valid, unexpired token. Clears the token after use.
 * Also signs and returns a JWT for immediate login.
 *
 * Body:
 * - token    (string, required)
 * - id       (string, required; user id)
 * - password (string, required; validated by `validatePassword`)
 *
 * Responses:
 * - 200 OK: { message, token, user }
 * - 400 Bad Request / Invalid Token: { message }
 * - 500 Server Error
 */
router.post("/reset-password", async (req: Request, res: Response) => {
  try {
    const { token, id, password } = req.body ?? {};
    if (!token || !id || !password) {
      return badRequest(res, "Token, id, and password are required");
    }
    if (!validatePassword(password)) {
      return badRequest(
        res,
        "Password must be at least 8 characters and include at least 1 letter and 1 number"
      );
    }

    // Validate token & expiration
    const user: IUser | null = await User.findOne({
      _id: id,
      passwordResetToken: hashToken(token),
      passwordResetTokenExp: { $gt: new Date() },
    });

    if (!user) return res.status(400).json({ message: "Invalid or expired reset token" });

    // Update password and clear reset token
    user.password = password;
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
    console.error("Reset password error:", error);
    return res.status(500).json({ message: "Failed to reset password" });
  }
});

export default router;
