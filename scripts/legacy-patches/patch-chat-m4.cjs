#!/usr/bin/env node
const fs = require('fs');
const FILE = 'src/screens/Chat.jsx';
let src = fs.readFileSync(FILE, 'utf8');

const edits = [];
function add(from, to, label) { edits.push({ from, to, label }); }

// 1. Imports
add(
`import { useVoiceCall } from '../lib/voiceCall'`,
`import { useVoiceCall } from '../lib/voiceCall'
import { useVoiceRecorder } from '../lib/useVoiceRecorder'
import Waveform from '../components/chat/Waveform'
import VanishModeOverlay from '../components/chat/VanishModeOverlay'`,
'imports'
);

// 2. State + Hook + Screenshot Guard
add(
`  const [viewOnce, setViewOnce] = useState(false)`,
`  const [viewOnce, setViewOnce] = useState(false)
  const [vanishMode, setVanishMode] = useState(false)
  const voiceRecorder = useVoiceRecorder()
  const vanishTouchY = useRef(null)

  // Screenshot Guard (PrivacyScreen) for View Once
  useEffect(() => {
    if (viewOnceActive) { setPrivacyScreen(true) }
    else { setPrivacyScreen(false) }
    return () => { setPrivacyScreen(false) }
  }, [viewOnceActive])`,
'state + guard'
);

// 3. Replace Recording Logic
const oldRecord = `  async function startRecording() {
    if (recording) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm'
      const mr = new MediaRecorder(stream, { mimeType: mime })
      recordChunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) recordChunksRef.current.push(e.data) }
      mr.onstop = () => { stream.getTracks().forEach((t) => t.stop()); clearInterval(recordTimerRef.current) }
      mr.start()
      recorderRef.current = mr
      setRecording(true); setRecordSeconds(0)
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000)
      tap('medium')
    } catch (err) { setError('Microphone access denied. ' + (err?.message || '')) }
  }

  async function stopRecording(send_it) {
    if (send_it && !canMsg) { setError(canMsgReason || "You can't message this user"); return }
    const mr = recorderRef.current
    if (!mr) return
    clearInterval(recordTimerRef.current)
    const seconds = recordSeconds
    await new Promise((resolve) => { mr.addEventListener('stop', resolve, { once: true }); mr.stop() })
    recorderRef.current = null
    setRecording(false); setRecordSeconds(0)
    if (!send_it) return
    if (seconds < 1) { setError('Recording too short.'); return }
    const blob = new Blob(recordChunksRef.current, { type: 'audio/webm' })
    recordChunksRef.current = []
    if (blob.size > 10 * 1024 * 1024) { setError('Voice note too long.'); return }
    setSending(true)
    const path = \`\${conversationId}/\${crypto.randomUUID()}.webm\`
    const { error: upErr } = await supabase.storage.from('chat-media').upload(path, blob, { upsert: false, contentType: 'audio/webm' })
    if (upErr) { setError(upErr.message); setSending(false); return }
    const { data: pub } = supabase.storage.from('chat-media').getPublicUrl(path)
    const payload = { conversation_id: conversationId, sender_id: myId, content: '', media_url: pub?.publicUrl || null, media_type: 'audio/webm', media_name: \`Voice · \${seconds}s\` }
    if (replyingTo?.id) payload.reply_to_id = replyingTo.id
    if (viewOnce) payload.view_once = true`;

add(oldRecord, `  async function startRecording() {
    if (!canMsg) { setError(canMsgReason || "You can't message this user"); return }
    try { await voiceRecorder.start(); tap('medium') } catch (err) { setError('Microphone access denied.') }
  }

  async function stopRecording(send_it) {
    if (send_it && !canMsg) { setError(canMsgReason || "You can't message this user"); return }
    try {
      const res = await voiceRecorder.stop({ send: send_it })
      if (!res) return
      if (res.duration < 1) { setError('Recording too short.'); return }
      setSending(true)
      const path = \`\${conversationId}/\${crypto.randomUUID()}.webm\`
      const { error: upErr } = await supabase.storage.from('chat-media').upload(path, res.blob, { upsert: false, contentType: 'audio/webm' })
      if (upErr) { setError(upErr.message); setSending(false); return }
      const { data: pub } = supabase.storage.from('chat-media').getPublicUrl(path)
      const payload = { 
        conversation_id: conversationId, 
        sender_id: myId, 
        content: '', 
        media_url: pub?.publicUrl || null, 
        media_type: 'audio/webm', 
        media_name: \`Voice · \${res.duration}s\`,
        voice_duration_seconds: res.duration,
        voice_waveform: res.waveform
      }
      if (replyingTo?.id) payload.reply_to_id = replyingTo.id
      if (viewOnce) {
        payload.view_once = true
        payload.ephemeral_type = 'VIEW_ONCE'
      }`, 'replace recording logic'
);

// 4. Vanish Mode Swipe Gesture (Using exact multiline div from recon)
add(
`  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      margin: '0 auto', maxWidth: 480,
      display: 'flex', flexDirection: 'column',
      background: '#0B0B14', overflow: 'hidden',
    }}>`,
`  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      margin: '0 auto', maxWidth: 480,
      display: 'flex', flexDirection: 'column',
      background: '#0B0B14', overflow: 'hidden',
    }}
    onTouchStart={(e) => { if (!vanishMode) vanishTouchY.current = e.touches[0].clientY }}
    onTouchEnd={(e) => {
      if (!vanishMode && vanishTouchY.current) {
        const dy = vanishTouchY.current - e.changedTouches[0].clientY
        if (dy > 80) { setVanishMode(true); tap("medium") }
        vanishTouchY.current = null
      }
    }}>`,
'vanish swipe'
);

// 5. Render Vanish Mode Overlay
add(
`      <ReportModal
        open={reportOpen}`,
`      {vanishMode && <VanishModeOverlay onExit={() => { setVanishMode(false); tap("light") }} />}
      
      <ReportModal
        open={reportOpen}`,
'vanish render'
);

// 6. Waveform UI (Replacing the old input)
add(
`        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={pickAttachment} />`,
`        {voiceRecorder.recording && (
          <div className="flex-1 flex items-center px-4 bg-red-500/10 border border-red-500/20 rounded-2xl h-11">
            <span className="text-red-500 font-bold text-[12px] animate-pulse mr-2">● REC {voiceRecorder.seconds}s</span>
            <Waveform data={voiceRecorder.waveform} mine={true} />
            <span className="text-muted text-[10px] ml-auto">Slide up to cancel</span>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={pickAttachment} />`,
'waveform ui'
);

// ===== PREFLIGHT =====
console.log('--- preflight ---');
let ok = true;
for (const e of edits) {
  const c = src.split(e.from).length - 1;
  if (c === 0) { console.error(`\u274c MISSING: ${e.label}`); ok = false; }
  else if (c > 1) { console.error(`\u274c NOT UNIQUE (${c}x): ${e.label}`); ok = false; }
  else { console.log(`\u2705 ok: ${e.label}`); }
}
if (!ok) { console.error('\n\u274c Preflight failed. File untouched.'); process.exit(1); }

console.log('\n--- applying ---');
for (const e of edits) {
  src = src.replace(e.from, e.to);
  console.log(`\u2705 ${e.label}`);
}
fs.writeFileSync(FILE, src);
console.log(`\n\u2705 Done. ${edits.length} edits applied to ${FILE}`);
