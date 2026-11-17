#!/usr/bin/env node
const fs = require('fs');

const edits = [];
function add(FILE, from, to, label) { edits.push({ FILE, from, to, label }); }

// --- 1. App.jsx (Add Hashtag Route) ---
const APP = 'src/App.jsx';
add(APP, `import Search from "./screens/Search"`, `import Search from "./screens/Search"\nimport HashtagPage from "./screens/HashtagPage"`, 'App: import');
add(APP, `<Route path="/search" element={<Guard><Search /></Guard>} />`, `<Route path="/search" element={<Guard><Search /></Guard>} />\n        <Route path="/hashtag/:tag" element={<Guard><HashtagPage /></Guard>} />`, 'App: route');

// --- 2. HashtagText.jsx (Route to HashtagPage) ---
const HT = 'src/components/HashtagText.jsx';
add(HT, `nav("/search?q=" + encodeURIComponent(part))`, `nav("/hashtag/" + part.replace("#", ""))`, 'HT: route');

// --- 3. Chat.jsx (Doc Sharing) ---
const CHAT = 'src/screens/Chat.jsx';
add(CHAT, `import ImageLightbox from '../components/chat/ImageLightbox'`, `import ImageLightbox from '../components/chat/ImageLightbox'\nimport DocBubble from '../components/chat/DocBubble'`, 'Chat: import Doc');
add(CHAT, `  const [viewOnce, setViewOnce] = useState(false)`, `  const [viewOnce, setViewOnce] = useState(false)\n  const docInputRef = useRef(null)`, 'Chat: doc ref');

// Add function to pick/send doc
add(CHAT, `  async function startRecording() {`, `  async function pickDocument(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 15 * 1024 * 1024) { setError("File is too large (max 15MB)"); return }
    
    setSending(true)
    const path = \`\${conversationId}/\${crypto.randomUUID()}.\${file.name.split('.').pop()}\`
    const { error: upErr } = await supabase.storage.from('chat-media').upload(path, file, { upsert: false, contentType: file.type })
    
    if (upErr) { setError(upErr.message); setSending(false); return }
    const { data: pub } = supabase.storage.from('chat-media').getPublicUrl(path)
    
    const payload = { 
      conversation_id: conversationId, sender_id: myId, content: '', 
      media_url: pub?.publicUrl, media_type: file.type, media_name: file.name 
    }
    if (replyingTo?.id) payload.reply_to_id = replyingTo.id
    
    const { data: inserted, error: sendErr } = await supabase.from('messages').insert(payload).select().single()
    if (sendErr) setError(friendlyError(sendErr))
    else if (inserted) setMessages(cur => [...cur, inserted])
    
    setSending(false); setReplyingTo(null)
    if (docInputRef.current) docInputRef.current.value = ''
  }

  async function startRecording() {`, 'Chat: pickDocument');

// Add input and menu button
add(CHAT, `        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={pickAttachment} />`, `        <input ref={docInputRef} type="file" accept="*/*" hidden onChange={pickDocument} />\n        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={pickAttachment} />`, 'Chat: doc input');
add(CHAT, `              <button\n                onClick={() => { setAttachMenuOpen(false); setTimeout(() => setPollComposerOpen(true), 120) }}`, `              <button\n                onClick={() => { setAttachMenuOpen(false); setTimeout(() => docInputRef.current?.click(), 100) }}\n                className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-white/6 text-left text-cream active:bg-white/[0.03]"\n              >\n                <span className="w-10 h-10 rounded-xl bg-purple-500/20 grid place-items-center shrink-0">\n                  <FileText size={18} className="text-purple-300" />\n                </span>\n                <div className="flex-1">\n                  <p className="font-bold text-[14.5px]">Document</p>\n                  <p className="text-muted text-[11.5px] mt-0.5">Send a PDF, doc, or zip</p>\n                </div>\n              </button>\n              <button\n                onClick={() => { setAttachMenuOpen(false); setTimeout(() => setPollComposerOpen(true), 120) }}`, 'Chat: doc menu btn');

// Add Document render logic (after ViewOnce, before Image Only)
add(CHAT, `                      // IMAGE ONLY — no bubble, just the image`, `                      // DOCUMENT — generic file
                      const isDoc = m.media_type && !m.media_type.startsWith('image/') && !m.media_type.startsWith('audio/') && !m.media_type.startsWith('video/')
                      if (isDoc) {
                        return (
                          <div className="max-w-[260px]">
                            <DocBubble url={m.media_url} name={m.media_name} type={m.media_type} mine={mine} />
                            {hasText && <div className="mt-1 px-1"><Linkify text={m.content} mine={mine} /></div>}
                          </div>
                        )
                      }

                      // IMAGE ONLY — no bubble, just the image`, 'Chat: doc render');

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
console.log(`\n\u2705 Done. ${edits.length} edits applied.`);
