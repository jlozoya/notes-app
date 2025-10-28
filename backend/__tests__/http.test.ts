import request from "supertest";
import { createApp } from "../src/app";

describe("HTTP /health", () => {
  it("200 ok", async () => {
    const app = createApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
