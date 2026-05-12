import Elysia from "elysia"

export const HealthController = new Elysia({ prefix: "/health" })
  .get("/", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  }))
