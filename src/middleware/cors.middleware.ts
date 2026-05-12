import { cors } from "@elysiajs/cors"

export const corsMiddleware = cors({
  origin: process.env.FRONT_URL || "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  maxAge: 86400,
})
