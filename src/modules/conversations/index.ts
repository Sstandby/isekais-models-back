import Elysia, { t } from "elysia"
import { eq, desc, and, sql, inArray, lt } from "drizzle-orm"
import { betterAuth } from "@/auth/auth.plugin"
import { db } from "@/lib/drizzle"
import { conversations, turns, turnActions } from "@/db/schema"

const JsonRecord = t.Record(t.String(), t.Unknown())

const TurnActionBody = t.Object({
  kind: t.String(),
  modelId: t.String(),
  data: JsonRecord,
})

export const ConversationsController = new Elysia({ prefix: "/conversations" })
  .use(betterAuth)

  .get(
    "/",
    async ({ user, query }) => {
      const limit = Math.min(Number(query.limit ?? 30), 50)
      const cursor = query.cursor ?? null

      const where = cursor
        ? and(eq(conversations.userId, user.id), lt(conversations.updatedAt, new Date(cursor)))
        : eq(conversations.userId, user.id)

      const rows = await db
        .select({
          id: conversations.id,
          title: conversations.title,
          primaryCategory: conversations.primaryCategory,
          createdAt: conversations.createdAt,
          updatedAt: conversations.updatedAt,
        })
        .from(conversations)
        .where(where)
        .orderBy(desc(conversations.updatedAt))
        .limit(limit + 1)

      const hasMore = rows.length > limit
      const items = hasMore ? rows.slice(0, limit) : rows
      const nextCursor = hasMore ? items[items.length - 1]!.updatedAt.toISOString() : null

      return {
        items: items.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        })),
        nextCursor,
      }
    },
    {
      auth: true,
      query: t.Object({
        limit: t.Optional(t.Numeric()),
        cursor: t.Optional(t.String()),
      }),
    }
  )

  .post(
    "/",
    async ({ body, user }) => {
      const id = crypto.randomUUID()
      const now = new Date()
      await db.insert(conversations).values({
        id,
        userId: user.id,
        title: body.title ?? "New conversation",
        primaryCategory: body.primaryCategory,
        createdAt: now,
        updatedAt: now,
      })
      return {
        id,
        title: body.title ?? "New conversation",
        primaryCategory: body.primaryCategory,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      }
    },
    {
      auth: true,
      body: t.Object({
        primaryCategory: t.String(),
        title: t.Optional(t.String()),
      }),
    }
  )

  .get(
    "/:id",
    async ({ params, user, status }) => {
      const [conv] = await db
        .select()
        .from(conversations)
        .where(and(eq(conversations.id, params.id), eq(conversations.userId, user.id)))

      if (!conv) return status(404, "Not found")

      const turnRows = await db
        .select()
        .from(turns)
        .where(eq(turns.conversationId, conv.id))
        .orderBy(turns.position)

      const actionRows = turnRows.length
        ? await db
            .select()
            .from(turnActions)
            .where(inArray(turnActions.turnId, turnRows.map((t) => t.id)))
        : []

      const actionsByTurn = actionRows.reduce<Record<string, typeof actionRows>>((acc, a) => {
        ;(acc[a.turnId] ??= []).push(a)
        return acc
      }, {})

      return {
        id: conv.id,
        title: conv.title,
        primaryCategory: conv.primaryCategory,
        createdAt: conv.createdAt.toISOString(),
        updatedAt: conv.updatedAt.toISOString(),
        turns: turnRows.map((turn) => ({
          id: turn.id,
          modelId: turn.modelId,
          modelLabel: turn.modelLabel,
          settings: turn.settings as Record<string, unknown>,
          status: turn.status,
          error: turn.error,
          payload: turn.payload as Record<string, unknown>,
          position: turn.position,
          promptTokens: turn.promptTokens,
          completionTokens: turn.completionTokens,
          totalTokens: turn.totalTokens,
          costUsd: turn.costUsd,
          createdAt: turn.createdAt.toISOString(),
          actions: (actionsByTurn[turn.id] ?? []).map((a) => ({
            id: a.id,
            kind: a.kind,
            modelId: a.modelId,
            data: a.data as Record<string, unknown>,
            createdAt: a.createdAt.toISOString(),
          })),
        })),
      }
    },
    { auth: true }
  )

  .patch(
    "/:id",
    async ({ params, body, user, status }) => {
      const [conv] = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(and(eq(conversations.id, params.id), eq(conversations.userId, user.id)))

      if (!conv) return status(404, "Not found")

      await db
        .update(conversations)
        .set({ title: body.title, updatedAt: new Date() })
        .where(eq(conversations.id, params.id))

      return { ok: true }
    },
    {
      auth: true,
      body: t.Object({ title: t.String() }),
    }
  )

  .delete(
    "/:id",
    async ({ params, user, status }) => {
      const [conv] = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(and(eq(conversations.id, params.id), eq(conversations.userId, user.id)))

      if (!conv) return status(404, "Not found")

      await db.delete(conversations).where(eq(conversations.id, params.id))
      return { ok: true }
    },
    { auth: true }
  )

  .post(
    "/:id/turns",
    async ({ params, body, user, status }) => {
      const [conv] = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(and(eq(conversations.id, params.id), eq(conversations.userId, user.id)))

      if (!conv) return status(404, "Not found")

      const [{ count }] = await db
        .select({ count: sql<string>`count(*)` })
        .from(turns)
        .where(eq(turns.conversationId, params.id))

      const position = parseInt(count, 10)
      const turnId = crypto.randomUUID()
      const now = new Date()

      await db.insert(turns).values({
        id: turnId,
        conversationId: params.id,
        modelId: body.modelId,
        modelLabel: body.modelLabel,
        settings: body.settings ?? {},
        status: body.status ?? "ok",
        error: body.error ?? null,
        payload: body.payload,
        position,
        promptTokens: body.promptTokens ?? 0,
        completionTokens: body.completionTokens ?? 0,
        totalTokens: body.totalTokens ?? 0,
        costUsd: body.costUsd ?? 0,
        createdAt: now,
      })

      await db.update(conversations).set({ updatedAt: now }).where(eq(conversations.id, params.id))

      if (body.actions?.length) {
        await db.insert(turnActions).values(
          body.actions.map((a) => ({
            id: crypto.randomUUID(),
            turnId,
            kind: a.kind,
            modelId: a.modelId,
            data: a.data,
            createdAt: now,
          }))
        )
      }

      return { id: turnId, position, createdAt: now.toISOString() }
    },
    {
      auth: true,
      body: t.Object({
        modelId: t.String(),
        modelLabel: t.String(),
        settings: t.Optional(JsonRecord),
        status: t.Optional(t.String()),
        error: t.Optional(t.Nullable(t.String())),
        payload: JsonRecord,
        actions: t.Optional(t.Array(TurnActionBody)),
        promptTokens: t.Optional(t.Number()),
        completionTokens: t.Optional(t.Number()),
        totalTokens: t.Optional(t.Number()),
        costUsd: t.Optional(t.Number()),
      }),
    }
  )

  .patch(
    "/:id/turns/:turnId",
    async ({ params, body, user, status }) => {
      const [conv] = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(and(eq(conversations.id, params.id), eq(conversations.userId, user.id)))

      if (!conv) return status(404, "Not found")

      const patch: Partial<{
        status: string; error: string | null; payload: Record<string, unknown>
        promptTokens: number; completionTokens: number; totalTokens: number; costUsd: number
      }> = {}
      if (body.status !== undefined) patch.status = body.status
      if (body.error !== undefined) patch.error = body.error
      if (body.payload !== undefined) patch.payload = body.payload
      if (body.promptTokens !== undefined) patch.promptTokens = body.promptTokens
      if (body.completionTokens !== undefined) patch.completionTokens = body.completionTokens
      if (body.totalTokens !== undefined) patch.totalTokens = body.totalTokens
      if (body.costUsd !== undefined) patch.costUsd = body.costUsd

      if (Object.keys(patch).length) {
        await db.update(turns).set(patch).where(eq(turns.id, params.turnId))
      }

      if (body.actions?.length) {
        const now = new Date()
        await db.insert(turnActions).values(
          body.actions.map((a) => ({
            id: crypto.randomUUID(),
            turnId: params.turnId,
            kind: a.kind,
            modelId: a.modelId,
            data: a.data,
            createdAt: now,
          }))
        )
      }

      return { ok: true }
    },
    {
      auth: true,
      body: t.Object({
        status: t.Optional(t.String()),
        error: t.Optional(t.Nullable(t.String())),
        payload: t.Optional(JsonRecord),
        actions: t.Optional(t.Array(TurnActionBody)),
        promptTokens: t.Optional(t.Number()),
        completionTokens: t.Optional(t.Number()),
        totalTokens: t.Optional(t.Number()),
        costUsd: t.Optional(t.Number()),
      }),
    }
  )
