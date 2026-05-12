const BASE = `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/images/v1`

export type CfImageUploadResult = {
  id: string
  url: string
}

export async function uploadToCloudflareImages(
  buffer: ArrayBuffer,
  filename: string,
  mimeType: string
): Promise<CfImageUploadResult> {
  const form = new FormData()
  form.append("file", new Blob([buffer], { type: mimeType }), filename)

  const res = await fetch(BASE, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.CF_IMAGES_TOKEN}` },
    body: form,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`CF Images upload failed: ${res.status} ${text}`)
  }

  const json = await res.json() as { result: { id: string; variants: string[] } }
  return {
    id: json.result.id,
    url: json.result.variants[0] ?? `https://imagedelivery.net/${process.env.CF_IMAGES_HASH}/${json.result.id}/public`,
  }
}

export async function deleteFromCloudflareImages(imageId: string): Promise<void> {
  await fetch(`${BASE}/${imageId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${process.env.CF_IMAGES_TOKEN}` },
  })
}
