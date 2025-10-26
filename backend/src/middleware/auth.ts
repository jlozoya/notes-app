import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

/**
 * Authenticated request type — keeps default Express headers typings,
 * and lets you still override params/body/query generics if you want.
 */
export interface AuthRequest<
  Params = Record<string, any>,
  ResBody = any,
  ReqBody = any,
  ReqQuery = any
> extends Request<Params, ResBody, ReqBody, ReqQuery> {
  userId?: string;
}

/**
 * Authentication middleware
 */
export function auth(req: AuthRequest, res: Response, next: NextFunction) {
  // ✅ "headers" is correctly recognized here
  const authHeader = req.headers?.authorization;
  const token = authHeader?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Missing token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret") as { id: string };
    req.userId = decoded.id;
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
}
