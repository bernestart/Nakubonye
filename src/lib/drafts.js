import { supabase } from "./supabase"

// Debounced auto-save helper. Returns a function to cancel.
export function autosaveDraft(userId, kind, payload, previewUrl) {
  let timer = null
  return function schedule() {
    if (timer) clearTimeout(timer)
    timer = setTimeout(async () => {
      if (!userId) return
      try {
        // We use a single draft per (user, kind) — upsert pattern
        const { data: existing } = await supabase
          .from("drafts")
          .select("id")
          .eq("user_id", userId)
          .eq("kind", kind)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle()

        if (existing?.id) {
          await supabase.from("drafts").update({
            payload,
            preview_url: previewUrl || null,
            updated_at: new Date().toISOString(),
          }).eq("id", existing.id)
        } else {
          await supabase.from("drafts").insert({
            user_id: userId,
            kind,
            payload,
            preview_url: previewUrl || null,
          })
        }
      } catch (e) { console.warn("draft autosave failed", e) }
    }, 1200)
  }
}

export async function deleteDraft(id) {
  if (!id) return
  try { await supabase.from("drafts").delete().eq("id", id) } catch {}
}

export async function deleteDraftsByKind(userId, kind) {
  if (!userId) return
  try { await supabase.from("drafts").delete().eq("user_id", userId).eq("kind", kind) } catch {}
}

export async function listDrafts(userId) {
  if (!userId) return []
  const { data } = await supabase
    .from("drafts")
    .select("id, kind, payload, preview_url, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(50)
  return data || []
}
