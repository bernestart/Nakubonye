const fs = require('fs')
const p = 'src/screens/ListingDetail.jsx'
let s = fs.readFileSync(p, 'utf8')

// 1. Add state for menu
const stateAnchor = `  const [saved, setSaved] = useState(false)`
if (!s.includes(stateAnchor)) throw new Error('saved state missing')
if (!s.includes('menuOpen')) {
  s = s.replace(stateAnchor, stateAnchor + `\n  const [menuOpen, setMenuOpen] = useState(false)\n  const [busy, setBusy] = useState(false)`)
}

// 2. Add handler functions
const shareFnAnchor = `  async function shareListing() {`
if (!s.includes(shareFnAnchor)) throw new Error('shareListing fn missing')

const handlers = `  async function markSold() {
    if (!listing || !myId || busy) return
    setBusy(true)
    const next = listing.status === "sold" ? "active" : "sold"
    await supabase.from("listings").update({ status: next, updated_at: new Date().toISOString() }).eq("id", listing.id)
    setListing((cur) => ({ ...cur, status: next }))
    setBusy(false)
    setMenuOpen(false)
  }

  async function deleteListing() {
    if (!listing || !myId || busy) return
    if (!confirm("Delete this listing permanently?")) return
    setBusy(true)
    await supabase.from("listings").delete().eq("id", listing.id)
    setBusy(false)
    setMenuOpen(false)
    nav(-1)
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(window.location.href); alert("Link copied") } catch {}
    setMenuOpen(false)
  }

  async function reportListing() {
    setMenuOpen(false)
    alert("Report submitted. Our team will review it.")
  }

`
s = s.replace(shareFnAnchor, handlers + shareFnAnchor)

// 3. Swap the Share header button for a menu button
const headerBtnOld = `        <button onClick={shareListing} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Share">
          <Share2 size={18} />
        </button>`

const headerBtnNew = `        <button onClick={shareListing} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Share">
          <Share2 size={18} />
        </button>
        <button onClick={() => { setMenuOpen(true); tap("light") }} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="More">
          <MoreVertical size={18} />
        </button>`

if (!s.includes(headerBtnOld)) throw new Error('header share button missing')
s = s.replace(headerBtnOld, headerBtnNew)

// 4. Render menu sheet before closing outer div
// The outer div has a `</div>` then `)` then `}` at end — we use "      </div>\n    </div>\n  )\n}" pattern
const endAnchor = `      </div>
    </div>
  )
}`
if (!s.includes(endAnchor)) throw new Error('component end anchor missing')

const menuSheet = `      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-[500] flex items-end" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[480px] mx-auto bg-[#0B0B14] rounded-t-[24px] border-t border-white/10 p-5 flex flex-col gap-2"
            style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-2" />
            {isOwner ? (
              <>
                <button
                  onClick={() => { setMenuOpen(false); nav(\`/marketplace/\${listing.id}/edit\`) }}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left"
                >
                  <span className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 grid place-items-center">
                    <Edit3 size={17} className="text-purple-300" />
                  </span>
                  <span className="text-cream font-semibold text-[14.5px]">Edit listing</span>
                </button>
                <button
                  onClick={markSold}
                  disabled={busy}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left disabled:opacity-50"
                >
                  <span className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 grid place-items-center">
                    <Tag size={17} className="text-purple-300" />
                  </span>
                  <span className="text-cream font-semibold text-[14.5px]">
                    {listing.status === "sold" ? "Mark as available" : "Mark as sold"}
                  </span>
                </button>
                <button
                  onClick={deleteListing}
                  disabled={busy}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/8 border border-red-500/25 text-left disabled:opacity-50"
                >
                  <span className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 grid place-items-center">
                    <Trash2 size={17} color="#F87171" />
                  </span>
                  <span className="text-cream font-semibold text-[14.5px]">Delete listing</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={toggleSave}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left"
                >
                  <span className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 grid place-items-center">
                    <Heart size={17} fill={saved ? "#C084FC" : "none"} className="text-purple-300" />
                  </span>
                  <span className="text-cream font-semibold text-[14.5px]">{saved ? "Unsave" : "Save listing"}</span>
                </button>
                <button
                  onClick={copyLink}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left"
                >
                  <span className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 grid place-items-center">
                    <Share2 size={17} className="text-purple-300" />
                  </span>
                  <span className="text-cream font-semibold text-[14.5px]">Copy link</span>
                </button>
                <button
                  onClick={reportListing}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left"
                >
                  <span className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 grid place-items-center">
                    <Tag size={17} color="#F87171" />
                  </span>
                  <span className="text-cream font-semibold text-[14.5px]">Report listing</span>
                </button>
              </>
            )}
            <button
              onClick={() => setMenuOpen(false)}
              className="w-full h-11 mt-2 text-muted font-semibold text-[13.5px]"
            >Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}`

s = s.replace(endAnchor, menuSheet)

// 5. Ensure Edit3 + Trash2 are imported
const lucideOld = `import { ArrowLeft, MapPin, Tag, Heart, MessageCircle, Share2, MoreVertical, ChevronLeft, ChevronRight } from 'lucide-react'`
const lucideNew = `import { ArrowLeft, MapPin, Tag, Heart, MessageCircle, Share2, MoreVertical, ChevronLeft, ChevronRight, Edit3, Trash2 } from 'lucide-react'`
if (s.includes(lucideOld)) s = s.replace(lucideOld, lucideNew)

fs.writeFileSync(p, s)
console.log('OK ListingDetail menu added')
