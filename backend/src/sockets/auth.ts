import jwt from "jsonwebtoken";
import type { Socket } from "socket.io";

export function attachSocketAuth(secret: string) {
  return (socket: Socket, next: (err?: Error) => void) => {
    try {
      const token =
        (socket.handshake.auth && (socket.handshake.auth as any).token) ||
        (socket.handshake.headers.authorization || "").replace(/^Bearer\s+/i, "");
      if (token) {
        const payload = jwt.verify(token, secret) as any;
        socket.data.userId = payload.sub || payload.userId || payload.id;
      }
      next();
    } catch (err) {
      next();
    }
  };
}
