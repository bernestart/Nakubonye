const fs = require('fs')
const p = 'src/screens/Chat.jsx'
let s = fs.readFileSync(p, 'utf8')

// 1. Add canMsgRequest state next to canMsg
const ST = `  const [canMsgReason, setCanMsgReason] = useState('')`
if (!s.includes(ST)) throw new Error('canMsgReason state anchor missing')
if (!s.includes('canMsgRequest'))
  s = s.replace(ST, ST + `\n  const [canMsgRequest, setCanMsgRequest] = useState(false)`)

// 2. Replace the permission-check effect — find the existing can_send_message rpc call
const EFFECT_OLD = `  useEffect(() => {
    if (!otherId || !session?.user?.id) return
    ;(async () => {
      const { data, error } = await supabase.rpc('can_send_message', {
        sender: session.user.id,
        recipient: otherId,
      })
      if (error) { setCanMsg(true); return }
      const allowed = data === true
      setCanMsg(allowed)
      setCanMsgReason(allowed ? '' : "You can't message this user")
    })()
  }, [otherId, session?.user?.id])`
if (!s.includes(EFFECT_OLD)) throw new Error('permission effect anchor missing')

const EFFECT_NEW = `  useEffect(() => {
    if (!otherId || !session?.user?.id) return
    ;(async () => {
      const uid = session.user.id
      const [directRes, reqRes] = await Promise.all([
        supabase.rpc('can_send_message_direct', { sender: uid, recipient: otherId }),
        supabase.rpc('can_send_message_request', { sender: uid, recipient: otherId }),
      ])
      const direct = directRes.data === true
      const request = reqRes.data === true
      setCanMsg(direct)
      setCanMsgRequest(request)
      if (direct) setCanMsgReason('')
      else if (request) setCanMsgReason("You don't know each other yet — send as a request")
      else setCanMsgReason("You can't message this user")
    })()
  }, [otherId, session?.user?.id])`

s = s.replace(EFFECT_OLD, EFFECT_NEW)

// 3. Rewrite the send() guard — requests only when canMsgRequest is true
const SEND_GUARD_OLD = `    // If we can't message this user normally — send as a request
    if (!canMsg) {
      if (!myId || !otherId) return
      setSending(true); tap('light')`
if (!s.includes(SEND_GUARD_OLD)) throw new Error('send guard anchor missing')

const SEND_GUARD_NEW = `    // If we can't message directly:
    //   canMsgRequest === true  → send as request
    //   canMsgRequest === false → hard block, nothing sends
    if (!canMsg) {
      if (!canMsgRequest) {
        setError(canMsgReason || "You can't message this user")
        return
      }
      if (!myId || !otherId) return
      setSending(true); tap('light')`

s = s.replace(SEND_GUARD_OLD, SEND_GUARD_NEW)

// 4. Update the composer UI — distinguish request mode from hard block
// Currently: `{!canMsg && (banner)}` + dimmed input.
// New: 3 states — direct / request / blocked

const BANNER_OLD = `      {!canMsg && (
        <div className="shrink-0 mx-3 mb-2 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-2">
          <span className="text-red-300 text-[13px] font-semibold leading-tight">{canMsgReason || "You can't message this user"}</span>
        </div>
      )}`
if (!s.includes(BANNER_OLD)) throw new Error('banner anchor missing')

const BANNER_NEW = `      {!canMsg && !canMsgRequest && (
        <div className="shrink-0 mx-3 mb-2 px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-2">
          <span className="text-red-300 text-[13px] font-semibold leading-tight">{canMsgReason || "You can't message this user"}</span>
        </div>
      )}

      {!canMsg && canMsgRequest && (
        <div className="shrink-0 mx-3 mb-2 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
          <span className="text-amber-300 text-[13px] font-semibold leading-tight">{canMsgReason}</span>
        </div>
      )}`

s = s.replace(BANNER_OLD, BANNER_NEW)

// 5. Input bar — only lock it out on hard block, not on request mode
const LOCK_OLD = `          pointerEvents: canMsg ? 'auto' : 'none',
          opacity: canMsg ? 1 : 0.4,`
if (!s.includes(LOCK_OLD)) throw new Error('input lock anchor missing')

const LOCK_NEW = `          pointerEvents: (canMsg || canMsgRequest) ? 'auto' : 'none',
          opacity: (canMsg || canMsgRequest) ? 1 : 0.4,`

s = s.replace(LOCK_OLD, LOCK_NEW)

// 6. Placeholder text — mention "as request" mode
const PH_OLD = `              placeholder={canMsg ? "Write a message…" : "Messaging is not allowed"}`
if (!s.includes(PH_OLD)) throw new Error('placeholder anchor missing')

const PH_NEW = `              placeholder={canMsg ? "Write a message…" : canMsgRequest ? "Write a request…" : "Messaging is not allowed"}`

s = s.replace(PH_OLD, PH_NEW)

fs.writeFileSync(p, s)
console.log('OK Chat.jsx two-tier message handling')
