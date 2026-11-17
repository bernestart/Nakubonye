#!/usr/bin/env node
const fs = require('fs');

const edits = [];
function add(FILE, from, to, label) { edits.push({ FILE, from, to, label }); }

// --- 1. App.jsx (Fix single quote & add Hashtag route) ---
const APP = 'src/App.jsx';
add(APP, `import Search from './screens/Search'`, `import Search from './screens/Search'\nimport HashtagPage from './screens/HashtagPage'`, 'App: import');
add(APP, `<Route path="/search" element={<Guard><Search /></Guard>} />`, `<Route path="/search" element={<Guard><Search /></Guard>} />\n        <Route path="/hashtag/:tag" element={<Guard><HashtagPage /></Guard>} />`, 'App: route');

// --- 2. HashtagText.jsx ---
const HT = 'src/components/HashtagText.jsx';
add(HT, `nav("/search?q=" + encodeURIComponent(part))`, `nav("/hashtag/" + part.replace("#", ""))`, 'HT: route');

// --- 3. Chat.jsx (DM) ---
const CHAT = 'src/screens/Chat.jsx';
add(CHAT, `import { useVoiceRecorder } from '../lib/useVoiceRecorder'`, `import { useVoiceRecorder } from '../components/chat/useVoiceRecorder'`, 'Chat: fix hook import');
add(CHAT, `import ImageLightbox from '../components/chat/ImageLightbox'`, `import ImageLightbox from '../components/chat/ImageLightbox'\nimport DocBubble from '../components/chat/DocBubble'`, 'Chat: import DocBubble');
add(CHAT, `  const [viewOnce, setViewOnce] = useState(false)`, `  const [viewOnce, setViewOnce] = useState(false)\n  const docInputRef = useRef(null)`, 'Chat: doc ref');

add(CHAT, `  async function startRecording() {`, `  async function pickDocument(e) {
    const file = e.target.files?.[0]; if (!file) return
    if (file.size > 15 * 1024 * 1024) { setError("File too large"); return }
    setSending(true)
    const path = \`\${conversationId}/\${crypto.randomUUID()}.\${file.name.split('.').pop()}\`
    const { error: upErr } = await supabase.storage.from('chat-media').upload(path, file, { contentType: file.type })
    if (upErr) { setError(upErr.message); setSending(false); return }
    const { data: pub } = supabase.storage.from('chat-media').getPublicUrl(path)
    const payload = { conversation_id: conversationId, sender_id: myId, content: '', media_url: pub?.publicUrl, media_type: file.type, media_name: file.name }
    if (replyingTo?.id) payload.reply_to_id = replyingTo.id
    const { data: inserted, error: sendErr } = await supabase.from('messages').insert(payload).select().single()
    if (sendErr) setError(sendErr.message); else if (inserted) setMessages(cur => [...cur, inserted])
    setSending(false); setReplyingTo(null); if (docInputRef.current) docInputRef.current.value = ''
  }

  async function startRecording() {`, 'Chat: pickDocument');

add(CHAT, `        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={pickAttachment} />`, `        <input ref={docInputRef} type="file" accept="*/*" hidden onChange={pickDocument} />\n        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={pickAttachment} />`, 'Chat: doc input');
add(CHAT, `              onClick={() => { setAttachMenuOpen(false); setTimeout(() => setPollComposerOpen(true), 120) }}`, `              onClick={() => { setAttachMenuOpen(false); setTimeout(() => docInputRef.current?.click(), 100) }}
              className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-white/6 text-left text-cream active:bg-white/[0.03]"
            >
              <span className="w-10 h-10 rounded-xl bg-purple-500/20 grid place-items-center shrink-0"><FileText size={18} className="text-purple-300" /></span>
              <div className="flex-1"><p className="font-bold text-[14.5px]">Document</p><p className="text-muted text-[11.5px] mt-0.5">Send a PDF, doc, or zip</p></div>
            </button>
            <button
              onClick={() => { setAttachMenuOpen(false); setTimeout(() => setPollComposerOpen(true), 120) }}`, 'Chat: doc menu btn');
add(CHAT, `                      // IMAGE ONLY — no bubble, just the image`, `                      const isDoc = m.media_type && !m.media_type.startsWith('image/') && !m.media_type.startsWith('audio/') && !m.media_type.startsWith('video/')
                      if (isDoc) return <div className="max-w-[260px]"><DocBubble url={m.media_url} name={m.media_name} type={m.media_type} mine={mine} /></div>

                      // IMAGE ONLY — no bubble, just the image`, 'Chat: doc render');


// --- 4. GroupChat.jsx ---
const GC = 'src/screens/GroupChat.jsx';
add(GC, `import { useVoiceRecorder } from "../components/chat/useVoiceRecorder"`, `import { useVoiceRecorder } from "../components/chat/useVoiceRecorder"\nimport DocBubble from "../components/chat/DocBubble"`, 'Group: import DocBubble');
add(GC, `import { Timer, Search, ArrowLeft, Send, Paperclip, X, MoreVertical, Users, Camera, Trash2, Flag, LogOut, UserPlus , Pencil , Link2 , Bell , Mic, Square , Pin , Eraser } from "lucide-react"`, `import { Timer, Search, ArrowLeft, Send, Paperclip, X, MoreVertical, Users, Camera, Trash2, Flag, LogOut, UserPlus , Pencil , Link2 , Bell , Mic, Square , Pin , Eraser, FileText } from "lucide-react"`, 'Group: add FileText icon');
add(GC, `  const [attachMenuOpen, setAttachMenuOpen] = useState(false)`, `  const [attachMenuOpen, setAttachMenuOpen] = useState(false)\n  const docInputRef = useRef(null)`, 'Group: doc ref');
add(GC, `  function pickAttachment(e) {`, `  async function pickDocument(e) {
    const file = e.target.files?.[0]; if (!file) return
    if (file.size > 15 * 1024 * 1024) { setError("File too large"); return }
    setSending(true)
    const path = \`\${conversationId}/\${crypto.randomUUID()}.\${file.name.split('.').pop()}\`
    const { error: upErr } = await supabase.storage.from('chat-media').upload(path, file, { contentType: file.type })
    if (upErr) { setError(upErr.message); setSending(false); return }
    const { data: pub } = supabase.storage.from('chat-media').getPublicUrl(path)
    const payload = { conversation_id: conversationId, sender_id: myId, content: '', media_url: pub?.publicUrl, media_type: file.type, media_name: file.name }
    if (replyingTo?.id) payload.reply_to_id = replyingTo.id
    const { data: inserted, error: sendErr } = await supabase.from('messages').insert(payload).select().single()
    if (sendErr) setError(sendErr.message); else if (inserted) setMessages(cur => [...cur, inserted])
    setSending(false); setReplyingTo(null); if (docInputRef.current) docInputRef.current.value = ''
  }

  function pickAttachment(e) {`, 'Group: pickDocument');
add(GC, `              <Paperclip size={18} className="text-purple-300" />
              <span className="font-semibold text-[14px]">Choose from gallery</span>`, `              <button onClick={() => { setAttachMenuOpen(false); setTimeout(() => docInputRef.current?.click(), 100) }} className="w-full flex items-center gap-3 py-2 text-left active:bg-white/5">
                <FileText size={18} className="text-purple-300" /><span className="font-semibold text-[14px]">Document</span>
              </button>
              <div className="w-full flex items-center gap-3 py-2 text-left">
              <Paperclip size={18} className="text-purple-300" />
              <span className="font-semibold text-[14px]">Choose from gallery</span>
              </div>`, 'Group: doc menu btn');
add(GC, `        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={pickAttachment} />`, `        <input ref={docInputRef} type="file" accept="*/*" hidden onChange={pickDocument} />\n        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={pickAttachment} />`, 'Group: doc input');
add(GC, `{m.media_url && m.media_type?.startsWith("image/") && (`, `{m.media_url && m.media_type && !m.media_type.startsWith("image/") && !m.media_type.startsWith("audio/") && !m.media_type.startsWith("video/") && (
                        <div className="max-w-[260px]"><DocBubble url={m.media_url} name={m.media_name} type={m.media_type} mine={mine} /></div>
                      )}
                      {m.media_url && m.media_type?.startsWith("image/") && (`, 'Group: doc render');


// --- 5. CommunityChat.jsx ---
const CC = 'src/components/CommunityChat.jsx';
add(CC, `import { useVoiceRecorder } from './chat/useVoiceRecorder'`, `import { useVoiceRecorder } from './chat/useVoiceRecorder'\nimport DocBubble from './chat/DocBubble'`, 'Community: import DocBubble');
add(CC, `import { Timer, Search, Send, Sparkles, Paperclip, Camera, X , Mic, Square , Pin , MoreVertical , Eraser , Bell, BellOff , Flag } from 'lucide-react'`, `import { Timer, Search, Send, Sparkles, Paperclip, Camera, X , Mic, Square , Pin , MoreVertical , Eraser , Bell, BellOff , Flag, FileText } from 'lucide-react'`, 'Community: add FileText icon');
add(CC, `  const [attachMenuOpen, setAttachMenuOpen] = useState(false)`, `  const [attachMenuOpen, setAttachMenuOpen] = useState(false)\n  const docInputRef = useRef(null)`, 'Community: doc ref');
add(CC, `  function pickAttachment(e) {`, `  async function pickDocument(e) {
    const file = e.target.files?.[0]; if (!file) return
    if (file.size > 15 * 1024 * 1024) { setError("File too large"); return }
    setSending(true)
    const path = \`community/\${communityId}/\${crypto.randomUUID()}.\${file.name.split('.').pop()}\`
    const { error: upErr } = await supabase.storage.from('chat-media').upload(path, file, { contentType: file.type })
    if (upErr) { setError(upErr.message); setSending(false); return }
    const { data: pub } = supabase.storage.from('chat-media').getPublicUrl(path)
    const payload = { community_id: communityId, sender_id: myId, content: '', media_url: pub?.publicUrl, media_type: file.type, media_name: file.name }
    if (replyingTo?.id) payload.reply_to_id = replyingTo.id
    const { data: inserted, error: sendErr } = await supabase.from('community_messages').insert(payload).select().single()
    if (sendErr) setError(sendErr.message); else if (inserted) setMessages(cur => [...cur, inserted])
    setSending(false); setReplyingTo(null); if (docInputRef.current) docInputRef.current.value = ''
  }

  function pickAttachment(e) {`, 'Community: pickDocument');
add(CC, `      <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={pickAttachment} />`, `      <input ref={docInputRef} type="file" accept="*/*" hidden onChange={pickDocument} />\n      <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={pickAttachment} />`, 'Community: doc input');
add(CC, `                    {m.media_url && m.media_type?.startsWith("image/") && (`, `                    {m.media_url && m.media_type && !m.media_type.startsWith("image/") && !m.media_type.startsWith("audio/") && !m.media_type.startsWith("video/") && (
                      <div className="max-w-[260px]"><DocBubble url={m.media_url} name={m.media_name} type={m.media_type} mine={mine} /></div>
                    )}
                    {m.media_url && m.media_type?.startsWith("image/") && (`, 'Community: doc render');

// ===== PREFLIGHT =====
console.log('--- preflight ---');
let ok = true;
const srcCache = {};
for (const e of edits) {
  if (!srcCache[e.FILE]) srcCache[e.FILE] = fs.readFileSync(e.FILE, 'utf8');
  const c = srcCache[e.FILE].split(e.from).length - 1;
  if (c === 0) { console.error(`\u274c MISSING in ${e.FILE}: ${e.label}`); ok = false; }
  else if (c > 1) { console.error(`\u274c NOT UNIQUE (${c}x) in ${e.FILE}: ${e.label}`); ok = false; }
  else { console.log(`\u2705 ok: ${e.label}`); }
}
if (!ok) { console.error('\n\u274c Preflight failed. Files untouched.'); process.exit(1); }

console.log('\n--- applying ---');
const applied = new Set();
for (const e of edits) {
  if (!applied.has(e.FILE)) { srcCache[e.FILE] = fs.readFileSync(e.FILE, 'utf8'); applied.add(e.FILE); }
  srcCache[e.FILE] = srcCache[e.FILE].replace(e.from, e.to);
  console.log(`\u2705 ${e.label}`);
}
for (const f of applied) fs.writeFileSync(f, srcCache[f]);
console.log(`\n\u2705 Done. ${edits.length} edits applied across ${applied.size} files.`);
