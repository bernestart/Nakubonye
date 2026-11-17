const fs = require('fs')
const p = 'src/screens/Reels.jsx'
let s = fs.readFileSync(p, 'utf8')

// 1. Add progress state
const STATE_ANCHOR = `  const [refreshing, setRefreshing] = useState(false)`
if (!s.includes(STATE_ANCHOR)) throw new Error('refreshing anchor missing')
if (!s.includes('reelProgress'))
  s = s.replace(STATE_ANCHOR, STATE_ANCHOR + `
  const [reelProgress, setReelProgress] = useState(0)`)

// 2. Extend onTimeUpdate to compute progress
const TIMEUPDATE_ANCHOR = `                  onTimeUpdate={(e) => {`
if (!s.includes(TIMEUPDATE_ANCHOR)) throw new Error('onTimeUpdate anchor missing')
if (!s.includes('setReelProgress'))
  s = s.replace(TIMEUPDATE_ANCHOR, `                  onTimeUpdate={(e) => {
                    if (idx === currentIdx) {
                      const v = e.target
                      if (v.duration > 0) setReelProgress(v.currentTime / v.duration)
                    }`)

// 3. Reset progress when the current reel changes
const IDX_EFFECT_ANCHOR = `  }, [currentIdx, reels, hiddenIds, muted])`
if (!s.includes(IDX_EFFECT_ANCHOR)) throw new Error('currentIdx effect end anchor missing')
if (!s.includes('setReelProgress(0)'))
  s = s.replace(IDX_EFFECT_ANCHOR, `  }, [currentIdx, reels, hiddenIds, muted])

  // Reset progress bar when switching reels
  useEffect(() => { setReelProgress(0) }, [currentIdx])`)

// 4. Render the bar — anchor on the mute button block closing to place near the bottom bar
// Better: place it right before the close of the outer scroll container. Find the closing of scroll container.
// The scroll container closes with `        </div>\n      )}`. It's unique-ish. Instead, insert before `<div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between`
// Actually — put the bar in the outer container, fixed at the bottom, above the bottom nav (Reels is fullscreen).

// Find the last closing div of the return before the final `)}`. Safer approach:
// Add it as a fixed-position element right after the top bar overlay. It'll be behind the reels but visible.
const TOPBAR_END = `        </button>
      </div>

      {loading ? (`
if (!s.includes(TOPBAR_END)) throw new Error('topbar end anchor missing')
s = s.replace(TOPBAR_END, `        </button>
      </div>

      {/* Bottom progress bar — only when viewing reels */}
      {!loading && reels.length > 0 && (
        <div
          className="absolute left-3 right-3 bottom-4 z-30 pointer-events-none"
          style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.25)", overflow: "hidden" }}
        >
          <div
            style={{
              height: "100%",
              width: \`\${Math.min(100, reelProgress * 100)}%\`,
              background: "#fff",
              borderRadius: 2,
              transition: "width 60ms linear",
            }}
          />
        </div>
      )}

      {loading ? (`)

fs.writeFileSync(p, s)
console.log('OK reel progress bar added')
