const fs = require('fs')
const p = 'src/screens/Chat.jsx'
let s = fs.readFileSync(p, 'utf8')

// 1. Import MessagePopover
const IMP = `import MessageActionsSheet from '../components/MessageActionsSheet'`
if (!s.includes(IMP)) throw new Error('sheet import anchor missing')
if (!s.includes('MessagePopover'))
  s = s.replace(IMP, IMP + `\nimport MessagePopover from '../components/MessagePopover'`)

// 2. Add popoverAnchor state
const ST = `  const [actionsForMsg, setActionsForMsg] = useState(null)`
if (!s.includes(ST)) throw new Error('actionsForMsg state anchor missing')
if (!s.includes('popoverAnchor'))
  s = s.replace(ST, ST + `\n  const [popoverAnchor, setPopoverAnchor] = useState({ x: 0, y: 0 })`)

// 3. Rewrite onMsgPressStart to capture anchor position
const PRESS_OLD = `  function onMsgPressStart(m) {
  longPressTimer.current = setTimeout(() => {
    tap("medium")
    setActionsForMsg(m)
  }, 450)
  }`
if (!s.includes(PRESS_OLD)) throw new Error('onMsgPressStart anchor missing')

const PRESS_NEW = `  function onMsgPressStart(m, e) {
  const t = e?.touches?.[0]
  const x = t?.clientX ?? window.innerWidth / 2
  const y = t?.clientY ?? window.innerHeight / 2
  longPressTimer.current = setTimeout(() => {
    tap("medium")
    setPopoverAnchor({ x, y })
    setActionsForMsg(m)
  }, 550)
  }`

s = s.replace(PRESS_OLD, PRESS_NEW)

// 4. onRowTouchStart — track startY + pass event to onMsgPressStart
const START_OLD = `  function onRowTouchStart(m, e) {
  swipeRef.current = { id: m.id, startX: e.touches[0].clientX, dx: 0, active: false }
  onMsgPressStart(m)
  }`
if (!s.includes(START_OLD)) throw new Error('onRowTouchStart anchor missing')

const START_NEW = `  function onRowTouchStart(m, e) {
  swipeRef.current = { id: m.id, startX: e.touches[0].clientX, startY: e.touches[0].clientY, dx: 0, active: false }
  onMsgPressStart(m, e)
  }`

s = s.replace(START_OLD, START_NEW)

// 5. onRowTouchMove — track dy, require horizontal dominance
const MOVE_OLD = `  function onRowTouchMove(e) {
  const sw = swipeRef.current
  if (!sw.id) return
  const dx = e.touches[0].clientX - sw.startX
  // Swipe only kicks in on a rightward drag of > 8px
  if (!sw.active && dx > 8) {
    sw.active = true
    // Cancel long-press since we're now swiping
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }
  if (sw.active) {
    sw.dx = Math.min(dx, 80)
    setSwipeState({ id: sw.id, dx: sw.dx })
  }
  }`
if (!s.includes(MOVE_OLD)) throw new Error('onRowTouchMove anchor missing')

const MOVE_NEW = `  function onRowTouchMove(e) {
  const sw = swipeRef.current
  if (!sw.id) return
  const dx = e.touches[0].clientX - sw.startX
  const dy = Math.abs(e.touches[0].clientY - (sw.startY || 0))
  // 20px right, at least 30% more horizontal than vertical
  if (!sw.active && dx > 20 && dx > dy * 1.3) {
    sw.active = true
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }
  if (sw.active) {
    sw.dx = Math.min(dx, 80)
    setSwipeState({ id: sw.id, dx: sw.dx })
  }
  }`

s = s.replace(MOVE_OLD, MOVE_NEW)

// 6. Trigger threshold 50 → 60
const T_OLD = `  const triggered = sw.active && sw.dx >= 50`
if (!s.includes(T_OLD)) throw new Error('trigger anchor missing')
s = s.replace(T_OLD, `  const triggered = sw.active && sw.dx >= 60`)

// 7. Add touchAction to the row style
const ROW_OLD = `                onContextMenu={(e) => { e.preventDefault(); setActionsForMsg(m) }}
                style={{
                  transform: swipeState.id === m.id ? \`translateX(\${swipeState.dx}px)\` : undefined,
                  transition: swipeState.id === m.id ? "none" : "transform 180ms ease-out",
                }}`
if (!s.includes(ROW_OLD)) throw new Error('row style anchor missing')

const ROW_NEW = `                onContextMenu={(e) => {
                  e.preventDefault()
                  setPopoverAnchor({ x: e.clientX, y: e.clientY })
                  setActionsForMsg(m)
                }}
                style={{
                  transform: swipeState.id === m.id ? \`translateX(\${swipeState.dx}px)\` : undefined,
                  transition: swipeState.id === m.id ? "none" : "transform 180ms ease-out",
                  touchAction: "pan-y",
                }}`

s = s.replace(ROW_OLD, ROW_NEW)

// 8. Replace MessageActionsSheet render block with MessagePopover
const SHEET_OLD = `      {actionsForMsg && (
        <MessageActionsSheet
          message={actionsForMsg}
          isMine={actionsForMsg.sender_id === myId}
          onClose={() => setActionsForMsg(null)}
          onReply={(m) => setReplyingTo(m)}
          onCopy={async () => { try { await navigator.clipboard.writeText(actionsForMsg.content || ""); setActionsForMsg(null) } catch {} }}
          onForward={(m) => { setActionsForMsg(null); setForwardingMsg(m) }}
          onDelete={deleteMessage}
          onReact={(emoji) => toggleReaction(actionsForMsg.id, emoji)}
          isPinned={pinnedMsg?.id === actionsForMsg.id}
          canUnsend={isWithinUnsendWindow(actionsForMsg.created_at)}
          onPin={togglePin}
        />
      )}`

if (!s.includes(SHEET_OLD)) throw new Error('sheet render anchor missing')

const SHEET_NEW = `      {actionsForMsg && (
        <MessagePopover
          message={actionsForMsg}
          anchor={popoverAnchor}
          isMine={actionsForMsg.sender_id === myId}
          isPinned={pinnedMsg?.id === actionsForMsg.id}
          canUnsend={isWithinUnsendWindow(actionsForMsg.created_at)}
          onClose={() => setActionsForMsg(null)}
          onReply={(m) => setReplyingTo(m)}
          onCopy={async () => { try { await navigator.clipboard.writeText(actionsForMsg.content || ""); setActionsForMsg(null) } catch {} }}
          onForward={(m) => { setActionsForMsg(null); setForwardingMsg(m) }}
          onDelete={deleteMessage}
          onReact={(emoji) => toggleReaction(actionsForMsg.id, emoji)}
          onPin={togglePin}
        />
      )}`

s = s.replace(SHEET_OLD, SHEET_NEW)

fs.writeFileSync(p, s)
console.log('OK popover wired + swipe fix')
