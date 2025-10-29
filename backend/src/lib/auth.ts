import jwt from "jsonwebtoken";
import { Response } from "express";
import crypto from "crypto";

export function signToken(userId: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not configured");
  return jwt.sign({ id: userId }, secret, { expiresIn: "7d" });
}

export function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(pw: string) {
  const okLen = typeof pw === "string" && pw.length >= 8;
  const hasLetter = /[A-Za-z]/.test(pw);
  const hasNumber = /\d/.test(pw);
  return okLen && hasLetter && hasNumber;
}

export function badRequest(res: Response, message: string) {
  return res.status(400).json({ message });
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function created(res: Response, payload: any) {
  return res.status(201).json(payload);
}

export function generateTokenPair() {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  return { token, tokenHash };
}
