// Offline reel cache — stores full video blobs in IndexedDB
// Browsers give us ~50-500 MB of quota depending on device.
// We cap by count (MAX_CACHED) not by bytes so behaviour is predictable.

import { supabase } from "./supabase"

const DB_NAME = "nakubonye_reel_cache"
const STORE = "reels"
const VERSION = 1
const MAX_CACHED = 10           // how many reels we keep cached
const MAX_BYTES = 100 * 1024 * 1024  // 100 MB safety cap

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "reelId" })
        store.createIndex("cached_at", "cached_at")
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx(mode, fn) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const store = t.objectStore(STORE)
    const result = fn(store)
    t.oncomplete = () => resolve(result)
    t.onerror = () => reject(t.error)
  })
}

// ─── Public API ─────────────────────────────────────

export async function listCached() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, "readonly")
    const req = t.objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
}

export async function getCachedBlob(reelId) {
  if (!reelId) return null
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, "readonly")
    const req = t.objectStore(STORE).get(reelId)
    req.onsuccess = () => resolve(req.result?.blob || null)
    req.onerror = () => reject(req.error)
  })
}

export async function isCached(reelId) {
  const blob = await getCachedBlob(reelId)
  return !!blob
}

// Cache a reel by downloading its video_url, then store the blob.
// Returns { ok, size, reason }
export async function cacheReel(reel, userId) {
  if (!reel?.id || !reel?.video_url) return { ok: false, reason: "no_url" }
  if (await isCached(reel.id)) return { ok: true, size: 0, reason: "already" }

  try {
    const res = await fetch(reel.video_url, { cache: "force-cache" })
    if (!res.ok) return { ok: false, reason: "http_" + res.status }
    const blob = await res.blob()
    const size = blob.size

    // Storage cap — evict oldest if over budget
    const all = await listCached()
    const totalBytes = all.reduce((s, r) => s + (r.size_bytes || 0), 0) + size
    if (totalBytes > MAX_BYTES || all.length >= MAX_CACHED) {
      const sorted = all.sort((a, b) => new Date(a.cached_at) - new Date(b.cached_at))
      const toRemove = sorted.slice(0, Math.max(1, all.length - MAX_CACHED + 1))
      for (const r of toRemove) {
        await deleteCached(r.reelId)
        try {
          await supabase.from("reel_cache").delete().eq("user_id", userId).eq("reel_id", r.reelId)
        } catch {}
      }
    }

    const record = {
      reelId: reel.id,
      blob,
      video_url: reel.video_url,
      thumbnail_url: reel.thumbnail_url || null,
      caption: reel.caption || null,
      user_id: reel.user_id || null,
      cached_at: new Date().toISOString(),
      size_bytes: size,
    }

    await tx("readwrite", (store) => store.put(record))

    // Mirror metadata to Supabase
    if (userId) {
      try {
        await supabase.from("reel_cache").upsert({
          user_id: userId,
          reel_id: reel.id,
          video_url: reel.video_url,
          thumbnail_url: reel.thumbnail_url || null,
          cached_at: new Date().toISOString(),
          size_bytes: size,
        }, { onConflict: "user_id,reel_id" })
      } catch {}
    }

    return { ok: true, size }
  } catch (e) {
    return { ok: false, reason: e.message || String(e) }
  }
}

export async function deleteCached(reelId) {
  if (!reelId) return
  await tx("readwrite", (store) => store.delete(reelId))
}

export async function clearCache(userId) {
  await tx("readwrite", (store) => store.clear())
  if (userId) {
    try { await supabase.from("reel_cache").delete().eq("user_id", userId) } catch {}
  }
}

export async function getCacheStats() {
  const all = await listCached()
  const totalBytes = all.reduce((s, r) => s + (r.size_bytes || 0), 0)
  return { count: all.length, totalBytes }
}

// Cleanup: remove reels cached more than N days ago
export async function cleanupOldReels(days = 7, userId = null) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  const all = await listCached()
  let removed = 0
  for (const r of all) {
    if (new Date(r.cached_at).getTime() < cutoff) {
      await deleteCached(r.reelId)
      if (userId) {
        try { await supabase.from("reel_cache").delete().eq("user_id", userId).eq("reel_id", r.reelId) } catch {}
      }
      removed++
    }
  }
  return removed
}
