import crypto from "crypto";
import bcrypt from "bcrypt";

export function generateToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString("hex"); // 64 chars
  const hash = bcrypt.hashSync(raw, 10);
  return { raw, hash };
}

export function verifyToken(raw: string, hash: string) {
  return bcrypt.compareSync(raw, hash);
}

export function expiryIn(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}
