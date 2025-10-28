import http from "http";
import { Server } from "socket.io";
import { io as Client } from "socket.io-client";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

import { setupNoteSockets } from "../src/sockets/notes.socket";
import { Note } from "../src/models/Note";

function once<T = any>(sock: any, ev: string) {
  return new Promise<T>(res => sock.once(ev, (data: T) => res(data)));
}

describe("notes socket - join + edit", () => {
  let httpServer: http.Server;
  let io: Server;
  let url: string;
  let mongo: MongoMemoryServer;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());

    httpServer = http.createServer();
    io = new Server(httpServer, { cors: { origin: "*" } });
    setupNoteSockets(io);

    await new Promise<void>(r => httpServer.listen(0, r));
    const { port } = httpServer.address() as any;
    url = `http://localhost:${port}`;
  });

  afterAll(async () => {
    io.close();
    await new Promise<void>(r => httpServer.close(() => r()));
    await mongoose.disconnect();
    await mongo.stop();
  });

  it("join válido emite load-note y edit propaga update a otros", async () => {
    const userId = new Types.ObjectId();
    const created = await Note.create({
      title: "Room A",
      html: "<p>init</p>",
      user: userId,
    });
    const id = created.id.toString();

    const a = Client(url, { autoConnect: true, transports: ["websocket"] });
    const b = Client(url, { autoConnect: true, transports: ["websocket"] });

    const loadedP = once<{ html: string; title: string }>(a, "load-note");
    const ackOkP = new Promise<boolean>(res =>
      a.emit("join", id, (ok: boolean) => res(ok))
    );

    const [payload, ok] = await Promise.all([loadedP, ackOkP]);
    expect(ok).toBe(true);
    expect(payload.title).toBe("Room A");

    await new Promise<boolean>(res => b.emit("join", id, (ok: boolean) => res(ok)));
    const updatedP = once<{ html: string; title: string }>(b, "update");
    a.emit("edit", { id, title: "T", html: "<p>x</p>" });

    const updated = await updatedP;
    expect(updated.title).toBe("T");
    expect(updated.html).toBe("<p>x</p>");

    a.disconnect();
    b.disconnect();
  });
});
