import Elysia, { t } from "elysia"
import { eq } from "drizzle-orm"
import { betterAuth } from "@/auth/auth.plugin"
import { db } from "@/lib/drizzle"
import { user } from "@/db/schema"
import { uploadToCloudflareImages } from "@/lib/cf-images"

export const ProfileController = new Elysia({ prefix: "/profile" })
  .use(betterAuth)

  .get(
    "/me",
    async ({ user: me }) => {
      const [row] = await db
        .select({ id: user.id, name: user.name, email: user.email, username: user.username, image: user.image, bio: user.bio, role: user.role })
        .from(user)
        .where(eq(user.id, me.id))
      return row
    },
    { auth: true }
  )

  .patch(
    "/me",
    async ({ body, user: me }) => {
      const patch: Partial<typeof user.$inferInsert> = {
        updatedAt: new Date(),
      }
      if (body.name !== undefined) patch.name = body.name
      if (body.username !== undefined) patch.username = body.username
      if (body.bio !== undefined) patch.bio = body.bio

      await db.update(user).set(patch).where(eq(user.id, me.id))

      const [updated] = await db
        .select({ id: user.id, name: user.name, email: user.email, username: user.username, image: user.image, bio: user.bio, role: user.role })
        .from(user)
        .where(eq(user.id, me.id))

      return updated
    },
    {
      auth: true,
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        username: t.Optional(t.String({ minLength: 1 })),
        bio: t.Optional(t.Nullable(t.String())),
      }),
    }
  )

  .post(
    "/me/avatar",
    async ({ body, user: me }) => {
      const buffer = await body.file.arrayBuffer()
      const ext = body.file.name.split(".").pop() ?? "png"
      const key = `avatars/${me.id}.${ext}`

      const result = await uploadToCloudflareImages(buffer, key, body.file.type)

      await db
        .update(user)
        .set({ image: result.url, updatedAt: new Date() })
        .where(eq(user.id, me.id))

      return { url: result.url }
    },
    {
      auth: true,
      body: t.Object({ file: t.File({ type: ["image/jpeg", "image/png", "image/webp"] }) }),
    }
  )
