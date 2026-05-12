import { AwsClient } from "aws4fetch"

function r2Client() {
  return new AwsClient({
    accessKeyId: process.env.CF_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY!,
    region: "auto",
    service: "s3",
  })
}

function r2Url(key: string) {
  return `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.CF_R2_BUCKET}/${key}`
}

export type R2UploadResult = {
  key: string
  url: string
}

export async function uploadToR2(
  buffer: ArrayBuffer,
  key: string,
  mimeType: string
): Promise<R2UploadResult> {
  const client = r2Client()
  const url = r2Url(key)

  const res = await client.fetch(url, {
    method: "PUT",
    headers: { "Content-Type": mimeType },
    body: buffer,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`R2 upload failed: ${res.status} ${text}`)
  }

  const publicUrl = process.env.CF_R2_PUBLIC_URL
    ? `${process.env.CF_R2_PUBLIC_URL}/${key}`
    : url

  return { key, url: publicUrl }
}

export async function deleteFromR2(key: string): Promise<void> {
  const client = r2Client()
  await client.fetch(r2Url(key), { method: "DELETE" })
}
