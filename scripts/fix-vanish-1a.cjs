// scripts/fix-vanish-1a.cjs — Milestone 1A: Vanish Mode menu toggle + banner
const fs = require('fs')
const path = require('path')

const CHAT = path.join(process.cwd(), 'src/screens/Chat.jsx')
const OVERLAY = path.join(process.cwd(), 'src/components/chat/VanishModeOverlay.jsx')

function abort(msg) { console.error('\n🛑 ABORT:', msg, '\n(no files touched)\n'); process.exit(1) }

if (!fs.existsSync(CHAT)) abort('src/screens/Chat.jsx missing')
if (!fs.existsSync(OVERLAY)) abort('src/components/chat/VanishModeOverlay.jsx missing')

let src = fs.readFileSync(CHAT, 'utf8')
const orig = src

// ---- PREFLIGHT ANCHORS ----
if (!src.includes('const [vanishMode, setVanishMode] = useState(false)')) abort('A1 vanishMode state')
if ((src.match(/vanishTouchY/g) || []).length !== 1) abort('A2 vanishTouchY count')
if (!src.includes('<MenuItem icon={<Eraser size={16} />} label="Clear chat"')) abort('A3 Clear chat MenuItem')
if (!src.includes('<MenuItem icon={<Flag size={16} />} label="Report"')) abort('A4 Report MenuItem')
if (!src.includes('{vanishMode && <VanishModeOverlay onExit={() => { setVanishMode(false); tap("light") }} />}')) abort('A5 old overlay render')
if ((src.match(/<\/header>/g) || []).length !== 1) abort('A6 </header> count')
if (!/import[^\n]*\bTimer\b[^\n]*from ['"]lucide-react['"]/.test(src)) abort('A7 Timer import')

console.log('✅ 7/7 anchors verified\n')

// ---- T1: remove dead vanishTouchY ref ----
src = src.replace(/[ \t]*const vanishTouchY = useRef\(null\)\r?\n/, '')

// ---- T2: insert Vanish mode MenuItem after Clear chat ----
const clearChatRe = /([ \t]*<MenuItem icon=\{<Eraser size=\{16\} \/>\} label="Clear chat"[^\n]*\n)/
const m = src.match(clearChatRe)
if (!m) abort('T2 Clear chat line regex')
const menuBlock = `                <MenuItem
                  icon={<Timer size={16} />}
                  label="Vanish mode"
                  onClick={() => { setVanishMode(v => !v); setMenuOpen(false); tap("light") }}
                />
`
src = src.replace(clearChatRe, m[1] + menuBlock)

// ---- T3: remove old full-screen overlay render ----
src = src.replace(/[ \t]*\{vanishMode && <VanishModeOverlay onExit=\{\(\) => \{ setVanishMode\(false\); tap\("light"\) \}\} \/>\}\r?\n/, '')

// ---- T4: insert slim banner render right after </header> ----
src = src.replace('</header>', '</header>\n      {vanishMode && <VanishModeOverlay onExit={() => { setVanishMode(false); tap("light") }} />}')

if (src === orig) abort('No changes applied to Chat.jsx')

fs.writeFileSync(CHAT, src)
console.log('✅ Chat.jsx patched')

// ---- T5: rewrite VanishModeOverlay as slim banner ----
fs.writeFileSync(OVERLAY, `export default function VanishModeOverlay({ onExit }) {
  return (
    <div className="flex-shrink-0 bg-black px-3 py-2 flex items-center justify-between gap-2 border-b border-white/10">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
        <p className="text-white/85 text-[12px] font-semibold truncate">
          Vanish mode is on · messages will disappear when you leave
        </p>
      </div>
      <button
        onClick={onExit}
        className="text-white/85 text-[11.5px] font-bold px-2.5 h-7 rounded-full bg-white/10 shrink-0"
      >
        Turn off
      </button>
    </div>
  )
}
`)
console.log('✅ VanishModeOverlay.jsx rewritten as banner')

console.log('\n🎯 Milestone 1A applied. Build, then device-test:')
console.log('  1. Long chat scroll — smooth, no vanish trigger')
console.log('  2. ⋮ menu — "Vanish mode" row between Clear chat + Report')
console.log('  3. Tap it — banner under header, chat STILL readable + scrollable')
console.log('  4. Tap banner "Turn off" — banner disappears')
