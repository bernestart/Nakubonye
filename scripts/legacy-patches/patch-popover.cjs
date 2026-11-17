const fs = require('fs')
const p = 'src/screens/Chat.jsx'
let s = fs.readFileSync(p, 'utf8')

// 1. Import popover
const IMP = `import MessageActionsSheet from '../components/MessageActionsSheet'`
if (!s.includes('MessagePopover'))
  s = s.replace(IMP, IMP + `\nimport MessagePopover from '../components/MessagePopover'`)

// 2. Add popoverAnchor state
const ST = `  const [actionsForMsg, setActionsForMsg] = useState(null)`
if (!s.includes('popoverAnchor'))
  s = s.replace(ST, ST + `\n  const [popoverAnchor, setPopoverAnchor] = useState({ x: 0, y: 0 })`)

// 3. onMsgPressStart — take event, save coords
const P_OLD = `  function onMsgPressStart(m) {
  longPressTimer.current = setTimeout(() => {
    tap("medium")
    setActionsForMsg(m)
  }, 450)
  }`
if (!s.includes(P_OLD)) throw new Error('press anchor missing')
s = s.replace(P_OLD, `  function onMsgPressStart(m, e) {
  const t = e?.touches?.[0]
  const x = t?.clientX ?? window.innerWidth / 2
  const y = t?.clientY ?? window.innerHeight / 2
  longPressTimer.current = setTimeout(() => {
    tap("medium")
    setPopoverAnchor({ x, y })
    setActionsForMsg(m)
  }, 550)
  }`)

// 4. onRowTouchStart — pass event
const S_OLD = `  function onRowTouchStart(m, e) {
  swipeRef.current = { id: m.id, startX: e.touches[0].clientX, startY: e.touches[0].clientY, dx: 0, active: false }
  onMsgPressStart(m)
  }`
if (!s.includes(S_OLD)) throw new Error('start anchor missing')
s = s.replace(S_OLD, `  function onRowTouchStart(m, e) {
  swipeRef.current = { id: m.id, startX: e.touches[0].clientX, startY: e.touches[0].clientY, dx: 0, active: false }
  onMsgPressStart(m, e)
  }`)

// 5. Row — add touchAction + capture contextMenu coords
const ROW_OLD = `                onContextMenu={(e) => { e.preventDefault(); setActionsForMsg(m) }}
                style={{
                  transform: swipeState.id === m.id ? \`translateX(\${swipeState.dx}px)\` : undefined,
                  transition: swipeState.id === m.id ? "none" : "transform 180ms ease-out",
                }}`
if (!s.includes(ROW_OLD)) throw new Error('row anchor missing')
s = s.replace(ROW_OLD, `                onContextMenu={(e) => {
                  e.preventDefault()
                  setPopoverAnchor({ x: e.clientX, y: e.clientY })
                  setActionsForMsg(m)
                }}
                style={{
                  transform: swipeState.id === m.id ? \`translateX(\${swipeState.dx}px)\` : undefined,
                  transition: swipeState.id === m.id ? "none" : "transform 180ms ease-out",
                  touchAction: "pan-y",
                }}`)

// 6. Replace the sheet render with popover
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
if (!s.includes(SHEET_OLD)) throw new Error('sheet anchor missing')

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
console.log('OK popover wired')
