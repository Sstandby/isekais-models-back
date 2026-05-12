import { cors } from "@elysiajs/cors"

const allowedOrigins = [
  process.env.FRONT_URL || "http://localhost:3000",
  "http://localhost:3000",
  "http://localhost:3001",
].filter(Boolean)

export const corsMiddleware = cors({
  origin: (request) => {
    const origin = request.headers.get("origin")
    if (!origin) return true
    return allowedOrigins.some(
      (allowed) => origin === allowed || origin.endsWith(".isekais.ai")
    )
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  maxAge: 86400,
})
