import "dotenv/config"
import { drizzle } from "drizzle-orm/node-postgres"
import * as schema from "@/db/schema"

export const db = drizzle({
  connection: {
    connectionString: process.env.DATABASE_URL!,
    ssl: false,
  },
  schema,
})
