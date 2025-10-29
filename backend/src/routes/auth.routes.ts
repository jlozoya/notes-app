import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { IUser, User } from "../models/User";
import { sendEmail } from "../lib/mailer";
import { badRequest, created, generateTokenPair, hashToken, isValidEmail, normalizeEmail, signToken, validatePassword } from "../lib/auth";

const router = Router();
const APP_URL = process.env.APP_URL || "https://notesapp.lozoya.org";


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

    const exists = await User.findOne({ email }).lean();
    if (exists) return res.status(409).json({ message: "User already exists" });

    const { token, tokenHash } = generateTokenPair();
    const emailVerifyExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user: IUser = new User({
      email,
      password,
      emailVerified: false,
      emailVerifyTokenHash: tokenHash,
      emailVerifyExpiresAt,
    });
    await user.save();

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
    if (error?.code === 11000) {
      return res.status(409).json({ message: "User already exists" });
    }
    console.error("Signup error:", error);
    return res.status(500).json({ message: "Failed to sign up" });
  }
});

router.get("/verify-email", async (req: Request, res: Response) => {
  try {
    const { token, id, redirect } = req.query as { token?: string; id?: string; redirect?: string };
    if (!token || !id) return res.status(400).json({ message: "Token and id are required" });

    const user = await User.findOne({
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

    if (redirect === "1") {
      return res.redirect(`${APP_URL}/verify?verified=1&token=${jwtToken}&id=${user._id}&email=${encodeURIComponent(user.email)}`);
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

router.post("/resend-verification", async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body?.email ?? "");
    if (!email) return badRequest(res, "Email is required");
    if (!isValidEmail(email)) return badRequest(res, "Invalid email format");

    const user: IUser | null = await User.findOne({ email });
    if (!user) {
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

router.post("/forgot-password", async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body?.email ?? "");
    if (!email) return badRequest(res, "Email is required");
    if (!isValidEmail(email)) return badRequest(res, "Invalid email format");

    const user: IUser | null = await User.findOne({ email });

    if (!user) return res.json({ message: "If an account exists, a reset link has been sent" });

    const { token, tokenHash } = generateTokenPair();
    user.passwordResetToken = tokenHash;
    user.passwordResetTokenExp = new Date(Date.now() + 60 * 60 * 1000);
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
        expiresText: "This link expires in 1 hour. If you did not request this, you can ignore this email.",
      },
    });

    return res.json({ message: "If an account exists, a reset link has been sent" });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ message: "Failed to process request" });
  }
});

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

    const user: IUser | null = await User.findOne({
      _id: id,
      passwordResetToken: hashToken(token),
      passwordResetTokenExp: { $gt: new Date() },
    });

    if (!user) return res.status(400).json({ message: "Invalid or expired reset token" });

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
