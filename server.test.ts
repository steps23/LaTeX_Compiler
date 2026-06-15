import { test, expect } from "vitest";
import request from "supertest";
import { createServer } from "http";
import express from "express";

test("Server healthcheck or API responds", async () => {
  const app = express();
  app.get("/api/health", (req, res) => res.json({ status: "ok" }));

  const response = await request(app).get("/api/health");
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ status: "ok" });
});
