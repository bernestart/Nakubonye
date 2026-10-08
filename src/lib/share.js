import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'

// Cross-platform share. Native (Android/iOS) uses the OS share sheet.
// Web falls back to navigator.share, then clipboard.
export async function shareContent({ title, text, url, dialogTitle } = {}) {
  const payload = { title, text, url }

  if (Capacitor.isNativePlatform()) {
    try {
      await Share.share({
        title: title || undefined,
        text: text || undefined,
        url: url || undefined,
        dialogTitle: dialogTitle || title || 'Share',
      })
      return true
    } catch (e) {
      // User cancelled — silently succeed
      if (e && e.message && /cancel/i.test(e.message)) return false
      // Fall through to web path if plugin fails
    }
  }

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share(payload)
      return true
    } catch (e) {
      if (e && e.name === 'AbortError') return false
    }
  }

  // Last resort: copy link to clipboard
  const link = url || text || ''
  if (link && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(link)
      return true
    } catch {}
  }
  return false
}
