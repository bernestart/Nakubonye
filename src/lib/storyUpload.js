
// ---------------------------------------------------------------------------
// Binary conversion helpers
// ---------------------------------------------------------------------------

export function base64ToBlob(base64, mime) {
  const byteCharacters = atob(base64)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  return new Blob([byteArray], { type: mime })
}

export function base64ToArrayBuffer(base64) {
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

async function blobToArrayBuffer(blob) {
  if (typeof blob.arrayBuffer === "function") {
    return await blob.arrayBuffer()
  }
  // Fallback for older WebViews
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error || new Error("Blob read failed"))
    reader.readAsArrayBuffer(blob)
  })
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

const BUCKET = "chat-media"

export async function uploadStoryMedia(blobOrBuffer, ext, contentType, myId) {
  // T2: stories use the same Telegram proxy as chat — no Supabase storage.
  const { uploadMedia } = await import("./api");
  const blob = blobOrBuffer instanceof Blob ? blobOrBuffer : new Blob([blobOrBuffer], { type: contentType || "image/jpeg" });
  return uploadMedia(blob); // returns Telegram file_id
}
