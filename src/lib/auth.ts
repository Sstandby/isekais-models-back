import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { openAPI } from "better-auth/plugins"
import { db } from "./drizzle"

const frontURL = process.env.FRONT_URL || "http://localhost:3000"
const backURL = process.env.BETTER_AUTH_URL || "http://localhost:3001"

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  baseURL: backURL,
  basePath: "/auth/api",
  appBaseURL: frontURL,
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    crossSubdomainCookies: {
      enabled: false,
    },
  },
  user: {
    additionalFields: {
      username: {
        type: "string",
        required: false,
        unique: true,
        defaultValue: () => `user_${Math.random().toString(36).slice(2, 8)}`,
      },
      role: {
        type: "string",
        required: false,
        defaultValue: "pending",
      },
    },
  },
  plugins: [openAPI()],
  trustedOrigins: [
    frontURL,
    "http://localhost:3000",
    "http://localhost:3001",
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 6,
    },
  },
})
