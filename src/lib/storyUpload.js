import { supabase } from "./supabase"

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
  if (!myId) throw new Error("Not signed in.")
  if (!blobOrBuffer) throw new Error("No media to upload.")

  // Normalise input to ArrayBuffer.
  // Supabase Storage on native WebViews does NOT accept File / Blob / FormData —
  // it requires an ArrayBuffer. This is the fix for the silent publish failure.
  let arrayBuffer
  let byteLength

  if (blobOrBuffer instanceof ArrayBuffer) {
    arrayBuffer = blobOrBuffer
    byteLength = arrayBuffer.byteLength
  } else if (blobOrBuffer instanceof Uint8Array) {
    arrayBuffer = blobOrBuffer.buffer.slice(
      blobOrBuffer.byteOffset,
      blobOrBuffer.byteOffset + blobOrBuffer.byteLength
    )
    byteLength = blobOrBuffer.byteLength
  } else if (typeof Blob !== "undefined" && blobOrBuffer instanceof Blob) {
    byteLength = blobOrBuffer.size
    if (byteLength === 0) {
      throw new Error("The file is empty (0 bytes). The native read failed.")
    }
    arrayBuffer = await blobToArrayBuffer(blobOrBuffer)
  } else {
    throw new Error("Unsupported media type for upload.")
  }

  if (!byteLength || byteLength === 0) {
    throw new Error("The file is empty (0 bytes). The native read failed.")
  }

  const safeId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).substring(2, 9);
  const path = `stories/${myId}/${safeId}.${ext}`

  console.log(`[Upload] Starting. Size: ${byteLength} bytes, Type: ${contentType}, Path: ${path}`)

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, { contentType, upsert: false })

  if (error) {
    console.error("[Upload] Supabase Error:", error)
    const msg = (error.message || "").toLowerCase()

    if (msg.includes("row-level security") || msg.includes("policy") || error.statusCode === 403) {
      throw new Error(
        `Upload denied. The '${BUCKET}' bucket needs an INSERT policy for authenticated users on the 'stories/' prefix.`
      )
    }
    if (error.statusCode === 413) {
      throw new Error("File is too large for Supabase limits (max 50MB).")
    }
    if (error.statusCode === 404) {
      throw new Error(`Bucket '${BUCKET}' not found. Check Supabase Storage configuration.`)
    }
    throw new Error("Upload failed: " + error.message)
  }

  return data.path
}
