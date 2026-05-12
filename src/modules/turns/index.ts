import Elysia, { t } from "elysia"
import { eq, and, desc, lt } from "drizzle-orm"
import { betterAuth } from "@/auth/auth.plugin"
import { db } from "@/lib/drizzle"
import { conversations, turns } from "@/db/schema"
import { user } from "@/db/schema/auth"

export const TurnsController = new Elysia({ prefix: "/turns" })
  .use(betterAuth)

  .patch(
    "/:turnId/like",
    async ({ params, user: u, status }) => {
      const [turn] = await db
        .select({ liked: turns.liked, conversationId: turns.conversationId })
        .from(turns)
        .where(eq(turns.id, params.turnId))

      if (!turn) return status(404, "Not found")

      const [conv] = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(and(eq(conversations.id, turn.conversationId), eq(conversations.userId, u.id)))

      if (!conv) return status(403, "Forbidden")

      const newLiked = !turn.liked
      await db.update(turns).set({ liked: newLiked }).where(eq(turns.id, params.turnId))
      return { liked: newLiked }
    },
    { auth: true }
  )

  .patch(
    "/:turnId/public",
    async ({ params, user: u, status }) => {
      const [turn] = await db
        .select({ isPublic: turns.isPublic, conversationId: turns.conversationId })
        .from(turns)
        .where(eq(turns.id, params.turnId))

      if (!turn) return status(404, "Not found")

      const [conv] = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(and(eq(conversations.id, turn.conversationId), eq(conversations.userId, u.id)))

      if (!conv) return status(403, "Forbidden")

      const newIsPublic = !turn.isPublic
      await db.update(turns).set({ isPublic: newIsPublic }).where(eq(turns.id, params.turnId))
      return { isPublic: newIsPublic }
    },
    { auth: true }
  )

  .get(
    "/gallery",
    async ({ query }) => {
      const limit = 20
      const cursor = query.cursor ?? null
      const category = query.category ?? null

      const baseWhere = eq(turns.isPublic, true)

      const rows = await db
        .select({
          id: turns.id,
          modelId: turns.modelId,
          modelLabel: turns.modelLabel,
          payload: turns.payload,
          liked: turns.liked,
          createdAt: turns.createdAt,
          userName: user.name,
          userUsername: user.username,
          userImage: user.image,
        })
        .from(turns)
        .innerJoin(conversations, eq(turns.conversationId, conversations.id))
        .innerJoin(user, eq(conversations.userId, user.id))
        .where(
          cursor
            ? and(baseWhere, lt(turns.createdAt, new Date(cursor)))
            : baseWhere
        )
        .orderBy(desc(turns.createdAt))
        .limit(limit + 1)

      const filtered = category
        ? rows.filter((r) => (r.payload as Record<string, unknown>).category === category)
        : rows

      const hasMore = filtered.length > limit
      const items = hasMore ? filtered.slice(0, limit) : filtered
      const nextCursor = hasMore ? items[items.length - 1]!.createdAt.toISOString() : null

      return {
        items: items.map((r) => ({
          id: r.id,
          modelId: r.modelId,
          modelLabel: r.modelLabel,
          payload: r.payload as Record<string, unknown>,
          liked: r.liked,
          createdAt: r.createdAt.toISOString(),
          user: {
            name: r.userName,
            username: r.userUsername,
            image: r.userImage,
          },
        })),
        nextCursor,
      }
    },
    {
      query: t.Object({
        cursor: t.Optional(t.String()),
        category: t.Optional(t.String()),
      }),
    }
  )
