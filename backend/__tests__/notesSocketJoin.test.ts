import { io as clientIO } from "socket.io-client";
import { createServer } from "../src/server";

describe("notes socket - join invalid id", () => {
  const srv = createServer();
  let port: number;

  beforeAll(async () => { port = await srv.start(0); });
  afterAll(async () => { await srv.stop(); });

  it("emite socket-error por ObjectId inválido y ack(false)", async () => {
    const socket = clientIO(`http://localhost:${port}`, { transports: ["websocket"], path: "/socket.io" });
    await new Promise<void>(res => socket.on("connect", () => res()));

    const gotError = new Promise<any>(res => socket.once("socket-error", res));
    const gotAck = new Promise<boolean>(res => {
      socket.emit("join", "invalid-id", (ok: boolean) => res(ok));
    });

    const [errMsg, ok] = await Promise.all([gotError, gotAck]);
    expect(ok).toBe(false);
    expect(errMsg?.message).toMatch(/invalid note id/i);

    socket.disconnect();
  });
});
