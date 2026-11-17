const fs = require('fs');
const p = 'src/components/StoryViewer.jsx';
let s = fs.readFileSync(p, 'utf8');
let n = 0;
function apply(find, replace, label) {
  if (!s.includes(find)) { console.error('❌ anchor not found:', label); process.exit(1); }
  s = s.replace(find, replace);
  console.log('✅', label);
  n++;
}

// 1. import helper
apply(
`import { supabase } from "../lib/supabase"`,
`import { supabase } from "../lib/supabase"
import { findOrCreateConversation } from "../lib/conversations"`,
'import helper');

// 2. new state
apply(
`  const [reply, setReply] = useState("")`,
`  const [reply, setReply] = useState("")
  const [toast, setToast] = useState(null)
  const [heartBurst, setHeartBurst] = useState(null)
  const [sending, setSending] = useState(false)`,
'add state');

// 3. new refs
apply(
`  const closingRef = useRef(false)`,
`  const closingRef = useRef(false)
  const lastTapRef = useRef(0)
  const toastTimerRef = useRef(null)
  const burstTimerRef = useRef(null)`,
'add refs');

// 4. helpers
apply(
`  async function canReply() {`,
`  function showToast(text, userId) {
    setToast({ text, userId })
    clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 2600)
  }

  function burstHeart() {
    setHeartBurst(Date.now())
    clearTimeout(burstTimerRef.current)
    burstTimerRef.current = setTimeout(() => setHeartBurst(null), 900)
  }

  async function canReply() {`,
'add helpers');

// 5. onTouchEnd — double-tap heart
apply(
`  function onTouchEnd(e, tapAction) {
    clearTimeout(longPressTimer.current)
    if (pressFiredRef.current) {
      resumeNow()
      pressFiredRef.current = false
      return
    }
    if (tapAction) tapAction()
  }`,
`  function onTouchEnd(e, tapAction) {
    clearTimeout(longPressTimer.current)
    if (pressFiredRef.current) {
      resumeNow()
      pressFiredRef.current = false
      return
    }
    const now = Date.now()
    const isDoubleTap = (now - lastTapRef.current) < 280
    lastTapRef.current = now
    if (isDoubleTap) {
      lastTapRef.current = 0
      if (!isMine && group?.user_id && story?.id) sendReaction("❤️")
      return
    }
    if (tapAction) tapAction()
  }`,
'onTouchEnd double-tap');

// 6. sendReply — use helper, stay on story, toast
apply(
`  async function sendReply() {
    const body = reply.trim()
    if (!body || !group?.user_id || !story?.id) return
    const ok = await canReply()
    if (!ok) { alert("This user isn't accepting story replies"); return }

    const { data: sess } = await supabase.auth.getSession()
    const myId = sess?.session?.user?.id
    if (!myId) return

    const or = "and(initiator_id.eq." + myId + ",recipient_id.eq." + group.user_id + ")," +
               "and(initiator_id.eq." + group.user_id + ",recipient_id.eq." + myId + ")"
    const { data: existing } = await supabase
      .from("conversations").select("id")
      .eq("is_direct", true).or(or).maybeSingle()

    let convId = existing?.id
    if (!convId) {
      const { data: created } = await supabase
        .from("conversations")
        .insert({ match_id: null, initiator_id: myId, recipient_id: group.user_id, is_direct: true })
        .select("id").single()
      convId = created?.id
    }
    if (!convId) { alert("Could not open chat"); return }

    const { error: sendErr } = await supabase.from("messages").insert({
      conversation_id: convId,
      sender_id: myId,
      content: body,
      metadata: {
        story_reply: {
          story_id: story.id,
          media_url: story.media_url,
          media_type: story.media_type,
        },
      },
    })
    if (sendErr) { alert("Send failed: " + sendErr.message); return }

    setReply("")
    tap("medium")
    onClose?.()
    nav("/messages/" + group.user_id)
  }`,
`  async function sendReply() {
    const body = reply.trim()
    if (!body || !group?.user_id || !story?.id || sending) return
    const ok = await canReply()
    if (!ok) { alert("This user isn't accepting story replies"); return }

    setSending(true)
    const convId = await findOrCreateConversation(group.user_id)
    if (!convId) { setSending(false); alert("Could not open chat"); return }

    const { data: sess } = await supabase.auth.getSession()
    const myId = sess?.session?.user?.id
    if (!myId) { setSending(false); return }

    const { error: sendErr } = await supabase.from("messages").insert({
      conversation_id: convId,
      sender_id: myId,
      content: body,
      metadata: {
        story_reply: {
          story_id: story.id,
          media_url: story.media_url,
          media_type: story.media_type,
        },
      },
    })
    setSending(false)
    if (sendErr) { alert("Send failed: " + sendErr.message); return }

    setReply("")
    tap("medium")
    showToast("Sent to " + (group.display_name?.split(" ")[0] || "them"), group.user_id)
  }`,
'sendReply');

// 7. sendReaction — use helper, stay on story, toast, heart burst
apply(
`  async function sendReaction(emoji) {
    setReactionOpen(false)
    if (!group?.user_id) return
    const ok = await canReply()
    if (!ok) { alert("This user isn't accepting story replies"); return }
    onClose?.()
    nav("/messages/" + group.user_id, {
      state: {
        prefill: emoji,
        storyReply: {
          story_id: story.id,
          media_url: story.media_url,
          media_type: story.media_type,
        },
      },
    })
  }`,
`  async function sendReaction(emoji) {
    setReactionOpen(false)
    if (!group?.user_id || !story?.id) return
    const ok = await canReply()
    if (!ok) { alert("This user isn't accepting story replies"); return }

    if (emoji === "❤️") burstHeart()

    const convId = await findOrCreateConversation(group.user_id)
    if (!convId) { alert("Could not open chat"); return }

    const { data: sess } = await supabase.auth.getSession()
    const myId = sess?.session?.user?.id
    if (!myId) return

    const { error: sendErr } = await supabase.from("messages").insert({
      conversation_id: convId,
      sender_id: myId,
      content: emoji,
      metadata: {
        story_reply: {
          story_id: story.id,
          media_url: story.media_url,
          media_type: story.media_type,
        },
      },
    })
    if (sendErr) { alert("Send failed: " + sendErr.message); return }

    tap("medium")
    showToast("Sent to " + (group.display_name?.split(" ")[0] || "them"), group.user_id)
  }`,
'sendReaction');

// 8. Reply bar polish — 😊 always visible, heart OR send
apply(
`            <input
              value={reply}
              onChange={(e) => setReply(e.target.value.slice(0, 200))}
              onKeyDown={(e) => { if (e.key === "Enter") sendReply() }}
              onFocus={pauseNow}
              onBlur={resumeNow}
              placeholder={"Reply to " + (group?.display_name?.split(" ")[0] || "them") + "…"}
              className="flex-1 h-10 rounded-full bg-black/35 backdrop-blur-sm border border-white/15 px-4 text-white text-[13.5px] placeholder:text-white/65 focus:outline-none focus:bg-black/50 focus:border-white/30"
            />
            {reply.trim() ? (
              <button
                onClick={sendReply}
                className="w-11 h-11 rounded-full grid place-items-center shrink-0"
                style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
                aria-label="Send reply"
              >
                <Send size={18} strokeWidth={2.6} className="text-white" />
              </button>
            ) : (
              <>
                <button
                  onClick={() => setReactionOpen((o) => !o)}
                  className="w-10 h-10 rounded-full grid place-items-center shrink-0 bg-black/35 backdrop-blur-sm border border-white/15"
                  aria-label="Reactions"
                >
                  <span className="text-[18px]">😊</span>
                </button>
                <button
                  onClick={() => sendReaction("❤️")}
                  className="w-10 h-10 rounded-full grid place-items-center shrink-0 bg-black/35 backdrop-blur-sm border border-white/15"
                  aria-label="Like story"
                >
                  <Heart size={19} fill="#EC4899" color="#EC4899" />
                </button>
              </>
            )}`,
`            <button
              onClick={() => setReactionOpen((o) => !o)}
              className="w-10 h-10 rounded-full grid place-items-center shrink-0 bg-black/35 backdrop-blur-sm border border-white/15"
              aria-label="Reactions"
            >
              <span className="text-[18px]">😊</span>
            </button>
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value.slice(0, 200))}
              onKeyDown={(e) => { if (e.key === "Enter") sendReply() }}
              onFocus={pauseNow}
              onBlur={resumeNow}
              placeholder={"Reply to " + (group?.display_name?.split(" ")[0] || "them") + "…"}
              className="flex-1 h-10 rounded-full bg-black/35 backdrop-blur-sm border border-white/15 px-4 text-white text-[13.5px] placeholder:text-white/65 focus:outline-none focus:bg-black/50 focus:border-white/30"
            />
            {reply.trim() ? (
              <button
                onClick={sendReply}
                disabled={sending}
                className="w-11 h-11 rounded-full grid place-items-center shrink-0 disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
                aria-label="Send reply"
              >
                <Send size={18} strokeWidth={2.6} className="text-white" />
              </button>
            ) : (
              <button
                onClick={() => sendReaction("❤️")}
                className="w-10 h-10 rounded-full grid place-items-center shrink-0 bg-black/35 backdrop-blur-sm border border-white/15"
                aria-label="Like story"
              >
                <Heart size={19} fill="#EC4899" color="#EC4899" />
              </button>
            )}`,
'reply bar');

// 9. Toast + heart burst render before portal close
apply(
`      </div>,
      document.body
    )
  }`,
`      {/* Heart burst animation */}
      {heartBurst && (
        <div className="absolute inset-0 grid place-items-center z-40 pointer-events-none">
          <Heart size={140} fill="#EC4899" color="#EC4899"
            style={{ animation: "nk-heart-burst 900ms cubic-bezier(0.22, 1, 0.36, 1) forwards" }} />
        </div>
      )}

      {/* Sent confirmation toast */}
      {toast && (
        <div
          className="absolute left-1/2 z-40 flex items-center gap-2 px-4 h-11 rounded-full bg-black/80 backdrop-blur-md border border-white/15 text-white text-[13px] font-semibold shadow-2xl"
          style={{
            bottom: "calc(env(safe-area-inset-bottom) + 76px)",
            animation: "nk-toast-in 220ms ease-out forwards",
          }}
        >
          <span>{toast.text} 💜</span>
          <button
            onClick={() => { onClose?.(); nav("/messages/" + toast.userId) }}
            className="text-purple-300 font-bold ml-1"
          >
            View
          </button>
        </div>
      )}

      </div>,
      document.body
    )
  }`,
'toast + heart burst render');

fs.writeFileSync(p, s);
console.log('✅ StoryViewer.jsx — ' + n + ' edits applied');
