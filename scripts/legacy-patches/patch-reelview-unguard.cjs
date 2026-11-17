const fs = require('fs')
const p = 'src/components/ReelViewer.jsx'
let s = fs.readFileSync(p, 'utf8')

// 1. Remove module-level Set (if present)
const setDecl = `const viewedThisSession = new Set()\n\n`
if (s.includes(setDecl)) s = s.replace(setDecl, '')

// 2. Replace the guarded timer with a clean insert + re-fetch of column value
const oldBlock = `    if (viewedThisSession.has(reel.id)) return

    const t = setTimeout(async () => {
      if (viewedThisSession.has(reel.id)) return
      viewedThisSession.add(reel.id)
      try {
        await supabase.from("reel_views").insert({ reel_id: reel.id, user_id: myId, watch_seconds: 3 })
        setViewCount((v) => v + 1)
      } catch {
        viewedThisSession.delete(reel.id)
      }
    }, 3000)
    return () => clearTimeout(t)`

const newBlock = `    const t = setTimeout(async () => {
      try {
        await supabase.from("reel_views").insert({ reel_id: reel.id, user_id: myId, watch_seconds: 3 })
        // Re-fetch the column — trigger only bumps on first-ever view by this user
        const { data: fresh } = await supabase.from("reels").select("view_count").eq("id", reel.id).maybeSingle()
        if (fresh) setViewCount(Number(fresh.view_count) || 0)
      } catch {}
    }, 3000)
    return () => clearTimeout(t)`

if (!s.includes(oldBlock)) throw new Error('guarded timer block missing')
s = s.replace(oldBlock, newBlock)

fs.writeFileSync(p, s)
console.log('OK ReelViewer view handling fixed')
