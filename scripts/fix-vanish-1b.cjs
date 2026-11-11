// scripts/fix-vanish-1b.cjs — Milestone 1B: Ephemeral Lifecycle
const fs = require('fs')
const path = require('path')
const CHAT = path.join(process.cwd(), 'src/screens/Chat.jsx')

function abort(msg) { console.error('\n🛑 ABORT:', msg, '\n(no files touched)\n'); process.exit(1) }

if (!fs.existsSync(CHAT)) abort('src/screens/Chat.jsx missing')
let src = fs.readFileSync(CHAT, 'utf8')

// ---- PREFLIGHT ANCHORS ----
const stateAnchor = "const [vanishMode, setVanishMode] = useState(false)"
if (!src.includes(stateAnchor)) abort('A1 vanishMode state')

const menuAnchor = 'onClick={() => { setVanishMode(v => !v); setMenuOpen(false); tap("light") }}'
if (!src.includes(menuAnchor)) abort('A2 menu onClick')

const insertCount = (src.match(/\.insert\(payload\)/g) || []).length
if (insertCount < 3) abort(`Expected >= 3 .insert(payload) calls, found ${insertCount}`)

console.log('✅ 3/3 anchors verified\n')

// ---- T1: Add vanishModeRef and unmount cleanup effect ----
const refAndEffect = `
  const vanishModeRef = useRef(vanishMode)
  useEffect(() => { vanishModeRef.current = vanishMode }, [vanishMode])

  useEffect(() => {
    return () => {
      if (vanishModeRef.current && conversationId) {
        supabase.from('messages').delete().eq('conversation_id', conversationId).eq('ephemeral_type', 'VANISH').then(({ error }) => {
          if (error) console.warn('Vanish cleanup error (RLS?):', error)
        })
      }
    }
  }, [conversationId])`
src = src.replace(stateAnchor, stateAnchor + refAndEffect)

// ---- T2: Update menu onClick to delete immediately when toggled OFF ----
const newMenuClick = `onClick={() => {
                  if (vanishMode) {
                    supabase.from('messages').delete().eq('conversation_id', conversationId).eq('ephemeral_type', 'VANISH').then(({ error }) => {
                      if (error) console.warn('Vanish cleanup error (RLS?):', error)
                    })
                  }
                  setVanishMode(v => !v);
                  setMenuOpen(false);
                  tap("light")
                }}`
src = src.replace(menuAnchor, newMenuClick)

// ---- T3: Inject ephemeral_type VANISH into all message payloads ----
src = src.replace(/\.insert\(payload\)/g, ".insert({ ...payload, ...((vanishModeRef.current && !payload.ephemeral_type) ? { ephemeral_type: 'VANISH' } : {}) })")

fs.writeFileSync(CHAT, src)
console.log('✅ Chat.jsx patched for Vanish 1B (ephemeral payload + cleanup + toggle-off delete)')
