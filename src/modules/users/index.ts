import Elysia, { t } from "elysia"
import { eq, gt, asc } from "drizzle-orm"
import { betterAuth } from "@/auth/auth.plugin"
import { db } from "@/lib/drizzle"
import { user } from "@/db/schema"

type UserRole = "pending" | "active" | "admin" | "super_admin"

async function getCallerRole(callerId: string): Promise<UserRole | null> {
  const [row] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, callerId))
  return (row?.role as UserRole) ?? null
}

export const UsersController = new Elysia({ prefix: "/admin/users" })
  .use(betterAuth)

  .get(
    "/",
    async ({ user: me, query, status }) => {
      const callerRole = await getCallerRole(me.id)
      if (callerRole !== "admin" && callerRole !== "super_admin") return status(403, "Forbidden")

      const limit = Math.min(Number(query.limit ?? 50), 100)
      const cursor = query.cursor ?? null

      const rows = await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username,
          image: user.image,
          role: user.role,
          createdAt: user.createdAt,
        })
        .from(user)
        .where(cursor ? gt(user.createdAt, new Date(cursor)) : undefined)
        .orderBy(asc(user.createdAt))
        .limit(limit + 1)

      const hasNext = rows.length > limit
      const items = hasNext ? rows.slice(0, limit) : rows
      const nextCursor = hasNext ? items[items.length - 1]!.createdAt.toISOString() : null

      return { items, nextCursor }
    },
    {
      auth: true,
      query: t.Object({
        limit: t.Optional(t.String()),
        cursor: t.Optional(t.String()),
      }),
    }
  )

  .patch(
    "/:id/role",
    async ({ user: me, params, body, status }) => {
      const callerRole = await getCallerRole(me.id)
      if (callerRole !== "admin" && callerRole !== "super_admin") return status(403, "Forbidden")

      const [target] = await db
        .select({ role: user.role })
        .from(user)
        .where(eq(user.id, params.id))

      if (!target) return status(404, "Not Found")

      if (target.role === "super_admin") return status(403, "Cannot change super_admin role")

      if (callerRole === "admin") {
        const allowedByAdmin: UserRole[] = ["pending", "active"]
        if (!allowedByAdmin.includes(body.role as UserRole)) {
          return status(403, "Admins can only set pending or active")
        }
      }

      await db
        .update(user)
        .set({ role: body.role, updatedAt: new Date() })
        .where(eq(user.id, params.id))

      return { success: true }
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
      body: t.Object({
        role: t.Union([
          t.Literal("pending"),
          t.Literal("active"),
          t.Literal("admin"),
        ]),
      }),
    }
  )

  .delete(
    "/:id",
    async ({ user: me, params, status }) => {
      const callerRole = await getCallerRole(me.id)
      if (callerRole !== "super_admin") return status(403, "Forbidden")

      if (params.id === me.id) return status(400, "Cannot delete yourself")

      const [target] = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, params.id))

      if (!target) return status(404, "Not Found")

      await db.delete(user).where(eq(user.id, params.id))

      return { success: true }
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
    }
  )
