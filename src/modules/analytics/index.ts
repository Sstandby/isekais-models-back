import Elysia, { t } from "elysia"
import { eq, desc, sql, count } from "drizzle-orm"
import { betterAuth } from "@/auth/auth.plugin"
import { db } from "@/lib/drizzle"
import { auth } from "@/lib/auth"
import { user, conversations, turns } from "@/db/schema"

const CF_BASE = `https://api.cloudflare.com/client/v4/accounts/58ca0e61dbaf978f0bb61000fb484aa9/ai-gateway/gateways/toc-toc-isekais/logs`

type CfLogEntry = {
  id: string
  request_type: string
  provider: string
  model: string
  start_time: string
  end_time: string
  duration: number
  prompt_tokens: number
  response_tokens: number
  total_tokens: number
  cost: number
  status_code: number
  cached: boolean
  metadata: Record<string, unknown>
}

type CfLogsResponse = {
  result: CfLogEntry[]
  success: boolean
}

async function fetchCfLogs(limit = 1000): Promise<CfLogEntry[]> {
  const token = process.env.CF_API_TOKEN
  if (!token) return []

  const url = new URL(CF_BASE)
  url.searchParams.set("limit", String(limit))
  url.searchParams.set("orderBy", "start_time")
  url.searchParams.set("direction", "desc")

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) return []

  const data = (await res.json()) as CfLogsResponse
  return data.result ?? []
}

async function resolveAdmin(headers: Headers): Promise<{ id: string; role: string } | null> {
  const session = await auth.api.getSession({ headers })
  if (!session) return null

  const [row] = await db
    .select({ id: user.id, role: user.role })
    .from(user)
    .where(eq(user.id, session.user.id))

  if (!row) return null
  if (row.role !== "admin" && row.role !== "super_admin") return null

  return row
}

export const AnalyticsController = new Elysia({ prefix: "/analytics" })
  .use(betterAuth)

  .get(
    "/overview",
    async ({ request: { headers }, status }) => {
      const admin = await resolveAdmin(headers)
      if (!admin) return status(403)

      const logs = await fetchCfLogs(1000)

      const totalCost = logs.reduce((s, l) => s + (l.cost ?? 0), 0)
      const totalTokens = logs.reduce((s, l) => s + (l.total_tokens ?? 0), 0)
      const totalRequests = logs.length

      const modelMap = new Map<string, { tokens: number; requests: number; cost: number }>()
      for (const l of logs) {
        const key = l.model ?? "unknown"
        const entry = modelMap.get(key) ?? { tokens: 0, requests: 0, cost: 0 }
        entry.tokens += l.total_tokens ?? 0
        entry.requests += 1
        entry.cost += l.cost ?? 0
        modelMap.set(key, entry)
      }

      const byModel = Array.from(modelMap.entries())
        .map(([model, stats]) => ({ model, ...stats }))
        .sort((a, b) => b.tokens - a.tokens)
        .slice(0, 10)

      const dayMap = new Map<string, { requests: number; tokens: number; cost: number }>()
      for (const l of logs) {
        const day = l.start_time ? l.start_time.slice(0, 10) : "unknown"
        const entry = dayMap.get(day) ?? { requests: 0, tokens: 0, cost: 0 }
        entry.requests += 1
        entry.tokens += l.total_tokens ?? 0
        entry.cost += l.cost ?? 0
        dayMap.set(day, entry)
      }
      const byDay = Array.from(dayMap.entries())
        .map(([day, stats]) => ({ day, ...stats }))
        .sort((a, b) => a.day.localeCompare(b.day))
        .slice(-30)

      return { totalCost, totalTokens, totalRequests, byModel, byDay }
    },
    { auth: true }
  )

  .get(
    "/conversations",
    async ({ request: { headers }, status }) => {
      const admin = await resolveAdmin(headers)
      if (!admin) return status(403)

      const rows = await db
        .select({
          id: conversations.id,
          title: conversations.title,
          primaryCategory: conversations.primaryCategory,
          createdAt: conversations.createdAt,
          updatedAt: conversations.updatedAt,
          totalTurns: count(turns.id),
          mostUsedModel: sql<string>`mode() within group (order by ${turns.modelId})`,
          totalTokens: sql<number>`coalesce(sum(${turns.totalTokens}), 0)`,
          totalCost: sql<number>`coalesce(sum(${turns.costUsd}), 0)`,
        })
        .from(conversations)
        .leftJoin(turns, eq(turns.conversationId, conversations.id))
        .groupBy(conversations.id)
        .orderBy(desc(conversations.updatedAt))

      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        primaryCategory: r.primaryCategory,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        totalTurns: r.totalTurns,
        mostUsedModel: r.mostUsedModel ?? null,
        totalTokens: Number(r.totalTokens),
        totalCost: Number(r.totalCost),
      }))
    },
    { auth: true }
  )

  .get(
    "/conversations/:id",
    async ({ params, request: { headers }, status }) => {
      const admin = await resolveAdmin(headers)
      if (!admin) return status(403)

      const [conv] = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, params.id))

      if (!conv) return status(404)

      const turnRows = await db
        .select({
          id: turns.id,
          modelId: turns.modelId,
          modelLabel: turns.modelLabel,
          status: turns.status,
          position: turns.position,
          createdAt: turns.createdAt,
          promptTokens: turns.promptTokens,
          completionTokens: turns.completionTokens,
          totalTokens: turns.totalTokens,
          costUsd: turns.costUsd,
        })
        .from(turns)
        .where(eq(turns.conversationId, params.id))
        .orderBy(turns.position)

      const enriched = turnRows.map((t) => ({
        id: t.id,
        modelId: t.modelId,
        modelLabel: t.modelLabel,
        status: t.status,
        position: t.position,
        createdAt: t.createdAt.toISOString(),
        promptTokens: t.promptTokens,
        responseTokens: t.completionTokens,
        totalTokens: t.totalTokens,
        cost: t.costUsd,
      }))

      return {
        id: conv.id,
        title: conv.title,
        primaryCategory: conv.primaryCategory,
        createdAt: conv.createdAt.toISOString(),
        updatedAt: conv.updatedAt.toISOString(),
        turns: enriched,
      }
    },
    {
      auth: true,
      params: t.Object({ id: t.String() }),
    }
  )
