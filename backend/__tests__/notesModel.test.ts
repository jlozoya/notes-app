import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Note } from "../src/models/Note";

describe("Note model", () => {
  let mongo: MongoMemoryServer;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it("creates and reads a note", async () => {
    const userId = new Types.ObjectId();
    const created = await Note.create({ title: "Test", html: "<p>Hi</p>", user: userId });
    const found = await Note.findById(created._id).lean();
    expect(found?.title).toBe("Test");
    expect(found?.user?.toString()).toBe(userId.toString());
  });
});
