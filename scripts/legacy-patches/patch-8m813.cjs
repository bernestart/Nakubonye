const fs = require('fs')
const p = 'src/screens/Chat.jsx'
let s = fs.readFileSync(p, 'utf8')

// 1. State for active view-once media
const stateAnchor = `  const [viewOnce, setViewOnce] = useState(false)`
if (!s.includes(stateAnchor)) throw new Error('viewOnce state anchor missing')
if (!s.includes('viewOnceActive')) {
  s = s.replace(stateAnchor, stateAnchor + `\n  const [viewOnceActive, setViewOnceActive] = useState(null)`)
}

// 2. Helper: mark as viewed + best-effort delete
const cleanupAnchor = `  async function deleteMessage(messageId) {`
if (!s.includes(cleanupAnchor)) throw new Error('deleteMessage anchor missing')

if (!s.includes('async function markViewOnceOpened')) {
  const helper = `  async function markViewOnceOpened(m) {
    if (!m || !myId) return
    const already = Array.isArray(m.viewed_by) && m.viewed_by.includes(myId)
    if (already) return
    const nextViewedBy = Array.isArray(m.viewed_by) ? [...m.viewed_by, myId] : [myId]
    setMessages((cur) => cur.map((x) => x.id === m.id ? { ...x, viewed_by: nextViewedBy } : x))
    try {
      await supabase.from("messages").update({ viewed_by: nextViewedBy }).eq("id", m.id)
      try {
        const url = m.media_url || ""
        const marker = "/object/public/chat-media/"
        const idx = url.indexOf(marker)
        if (idx !== -1) {
          await supabase.storage.from("chat-media").remove([url.slice(idx + marker.length)])
        }
      } catch (e) { console.warn("view-once media delete failed", e) }
    } catch (e) { console.warn("mark viewed failed", e) }
  }

` + cleanupAnchor
  s = s.replace(cleanupAnchor, helper)
}

// 3. Replace media render — insert view-once branch BEFORE the existing image check
const mediaStart = `                     {(() => {
                       const hasImage = m.media_url && m.media_type?.startsWith('image/')
                       const hasAudio = m.media_url && m.media_type?.startsWith('audio/')
                       const hasText = m.content && m.content.trim().length > 0

                       if (deleted) {
                         return (
                           <div className="px-3.5 py-2.5 text-[13px] italic bg-white/[0.04] border border-white/8 text-subtle rounded-2xl">
                             Message deleted
                           </div>
                         )
                       }
`

if (!s.includes(mediaStart)) throw new Error('media render start anchor missing')

const mediaNew = `                     {(() => {
                       const hasImage = m.media_url && m.media_type?.startsWith('image/')
                       const hasAudio = m.media_url && m.media_type?.startsWith('audio/')
                       const hasText = m.content && m.content.trim().length > 0

                       if (deleted) {
                         return (
                           <div className="px-3.5 py-2.5 text-[13px] italic bg-white/[0.04] border border-white/8 text-subtle rounded-2xl">
                             Message deleted
                           </div>
                         )
                       }

                       // View-once media
                       if (m.view_once && (hasImage || hasAudio)) {
                         const viewed = Array.isArray(m.viewed_by) && m.viewed_by.includes(myId)
                         if (mine) {
                           return (
                             <div className="px-3.5 py-2.5 rounded-2xl border border-purple-500/40 bg-purple-500/10 text-purple-100 text-[13px] flex items-center gap-2">
                               <span className="w-6 h-6 rounded-full grid place-items-center text-[11px] font-black border-2 border-purple-300">1</span>
                               <span>View once · {viewed ? "Opened" : "Sent"}</span>
                             </div>
                           )
                         }
                         if (viewed) {
                           return (
                             <div className="px-3.5 py-2.5 rounded-2xl border border-white/12 bg-white/[0.04] text-muted text-[13px] flex items-center gap-2">
                               <span className="w-6 h-6 rounded-full grid place-items-center text-[11px] font-black border-2 border-white/30">1</span>
                               <span>Opened</span>
                             </div>
                           )
                         }
                         return (
                           <button
                             onClick={() => { tap("light"); setViewOnceActive(m) }}
                             className="px-3.5 py-3 rounded-2xl border border-purple-500/50 bg-purple-500/10 text-purple-100 text-[13px] flex items-center gap-2 active:scale-[0.98] transition-transform"
                           >
                             <span className="w-6 h-6 rounded-full grid place-items-center text-[11px] font-black border-2 border-purple-300">1</span>
                             <span>Tap to view · {hasAudio ? "voice" : "photo"}</span>
                           </button>
                         )
                       }
`

s = s.replace(mediaStart, mediaNew)

// 4. Add the fullscreen view-once player — anchor on ReportModal render
const reportAnchor = `      <ReportModal
        open={reportOpen}`
if (!s.includes(reportAnchor)) throw new Error('ReportModal anchor missing')

if (!s.includes('viewOnceActive &&')) {
  const player = `      {viewOnceActive && (
        <div
          className="fixed inset-0 z-[600] bg-black flex items-center justify-center"
          onClick={() => {
            const m = viewOnceActive
            setViewOnceActive(null)
            markViewOnceOpened(m)
          }}
        >
          <div className="absolute top-4 right-4 z-10 px-3 h-8 rounded-full bg-white/15 text-white text-[12px] font-bold flex items-center gap-1.5">
            <span>1</span><span>View once</span>
          </div>
          {viewOnceActive.media_type?.startsWith("image/") ? (
            <img
              src={viewOnceActive.media_url}
              alt=""
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          ) : viewOnceActive.media_type?.startsWith("audio/") ? (
            <div onClick={(e) => e.stopPropagation()} className="p-6">
              <AudioBubble src={viewOnceActive.media_url} mine={false} />
              <p className="text-muted text-[12.5px] text-center mt-4">Tap anywhere to close</p>
            </div>
          ) : null}
        </div>
      )}

` + reportAnchor
  s = s.replace(reportAnchor, player)
}

fs.writeFileSync(p, s)
console.log('OK Chat.jsx: view-once viewer')
