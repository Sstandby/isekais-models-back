import Elysia, { t } from "elysia"
import { betterAuth } from "@/auth/auth.plugin"
import { uploadToCloudflareImages } from "@/lib/cf-images"
import { uploadToR2 } from "@/lib/cf-r2"

const IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
])

const AUDIO_MIME = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/ogg",
  "audio/flac",
  "audio/aac",
  "audio/webm",
  "audio/mp4",
])

const VIDEO_MIME = new Set([
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
])

export const MediaController = new Elysia({ prefix: "/media" })
  .use(betterAuth)
  .post(
    "/upload",
    async ({ body, status }) => {
      const { file } = body
      const mime = file.type
      const ext = file.name.split(".").pop() ?? "bin"
      const key = `${crypto.randomUUID()}.${ext}`
      const buffer = await file.arrayBuffer()

      if (IMAGE_MIME.has(mime)) {
        const result = await uploadToCloudflareImages(buffer, key, mime)
        return { type: "image" as const, url: result.url, id: result.id }
      }

      if (AUDIO_MIME.has(mime) || VIDEO_MIME.has(mime)) {
        const folder = AUDIO_MIME.has(mime) ? "audio" : "video"
        const result = await uploadToR2(buffer, `${folder}/${key}`, mime)
        return { type: "r2" as const, url: result.url, key: result.key }
      }

      return status(415, { error: "Unsupported media type" })
    },
    {
      auth: true,
      body: t.Object({ file: t.File() }),
    }
  )
