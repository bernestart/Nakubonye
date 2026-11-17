const fs = require('fs');

function patchFile(file, replacements) {
  let content = fs.readFileSync(file, 'utf8');
  for (const [search, replace, label] of replacements) {
    if (!content.includes(search)) {
      console.error('FAIL: Anchor not found in ' + file + ' for: ' + label);
      process.exit(1);
    }
    content = content.replace(search, replace);
  }
  fs.writeFileSync(file, content);
  console.log('✅ Patched ' + file);
}

// ==========================================
// 1. PATCH POSTCOMMENTSSHEET.JSX
// ==========================================
patchFile('src/components/PostCommentsSheet.jsx', [
  // Add imports
  [
    'import { useCallback, useEffect, useRef, useState } from "react"',
    'import { useCallback, useEffect, useRef, useState } from "react"\nimport { useVoiceRecorder } from "../lib/useVoiceRecorder"\nimport { Send, Mic, Square, Trash2 } from "lucide-react"',
    'imports'
  ],
  // Add state
  [
    'const [text, setText] = useState("")',
    'const [text, setText] = useState("")\n  const voice = useVoiceRecorder()',
    'voice hook'
  ],
  // Add submitVoiceNote function before submit
  [
    'async function submit() {',
    `async function submitVoiceNote() {
      if (!voice.recording || busy) return;
      setBusy(true);
      try {
        const res = await voice.stop(true);
        if (!res || !res.blob) { setBusy(false); return; }
        const path = \`comment-media/\${crypto.randomUUID()}.webm\`;
        const { error: upErr } = await supabase.storage.from("chat-media").upload(path, res.blob, { contentType: "audio/webm" });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("chat-media").getPublicUrl(path);
        const { error } = await supabase.from(table).insert({
          post_id: postId,
          user_id: myId,
          content: "",
          media_url: pub?.publicUrl,
          media_type: "audio/webm",
          reply_to_id: replyingTo?.id || null,
        });
        if (error) throw error;
        setText(""); setReplyingTo(null);
        load();
      } catch (e) {
        console.warn(e);
      }
      setBusy(false);
    }

    async function submit() {`,
    'submitVoiceNote fn'
  ],
  // Replace Input Bar
  [
    `<div className="flex items-center gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 800))}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) submit() }}
                placeholder={replyingTo ? "Write a reply…" : "Add a comment…"}
                className="flex-1 h-11 rounded-full bg-white/[0.06] border border-white/10 px-4 text-cream text-[14px] placeholder:text-subtle focus:outline-none focus:border-purple-500"
              />
              <button
                onClick={submit}
                disabled={!text.trim() || busy}
                className="w-11 h-11 rounded-full grid place-items-center disabled:opacity-40 shrink-0"
                style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }}
                aria-label="Send"
              >
                <Send size={18} strokeWidth={2.6} className="text-white" />
              </button>
            </div>`,
    `<div className="flex items-center gap-2">
              {voice.recording ? (
                <div className="flex-1 h-11 rounded-full bg-red-500/10 border border-red-500/30 px-4 flex items-center gap-3 text-red-400 font-mono text-[14px]">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  {Math.floor(voice.seconds / 60)}:{(voice.seconds % 60).toString().padStart(2, "0")}
                  <button onClick={() => voice.stop(false)} className="ml-auto"><Trash2 size={16} /></button>
                </div>
              ) : (
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, 800))}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) submit() }}
                  placeholder={replyingTo ? "Write a reply…" : "Add a comment…"}
                  className="flex-1 h-11 rounded-full bg-white/[0.06] border border-white/10 px-4 text-cream text-[14px] placeholder:text-subtle focus:outline-none focus:border-purple-500"
                />
              )}
              {voice.recording ? (
                <button onClick={submitVoiceNote} disabled={busy} className="w-11 h-11 rounded-full grid place-items-center disabled:opacity-40 shrink-0" style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }} aria-label="Send voice">
                  <Send size={18} strokeWidth={2.6} className="text-white" />
                </button>
              ) : (
                <>
                  <button onClick={() => voice.start()} disabled={busy} className="w-11 h-11 rounded-full grid place-items-center disabled:opacity-40 shrink-0 bg-white/[0.06] border border-white/10" aria-label="Record voice">
                    <Mic size={18} strokeWidth={2.6} className="text-muted" />
                  </button>
                  <button onClick={submit} disabled={!text.trim() || busy} className="w-11 h-11 rounded-full grid place-items-center disabled:opacity-40 shrink-0" style={{ background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)" }} aria-label="Send">
                    <Send size={18} strokeWidth={2.6} className="text-white" />
                  </button>
                </>
              )}
            </div>`,
    'input bar UI'
  ]
]);

// ==========================================
// 2. PATCH STORYCOMPOSER.JSX
// ==========================================
patchFile('src/components/StoryComposer.jsx', [
  // Add imports
  [
    'import { useEffect, useRef, useState } from "react"',
    'import { useEffect, useRef, useState } from "react"\nimport { useVoiceRecorder } from "../lib/useVoiceRecorder"\nimport { Mic, Square, Trash2, Send } from "lucide-react"',
    'imports'
  ],
  // Add state
  [
    'const [mode, setMode] = useState("media")',
    'const [mode, setMode] = useState("media")\n  const voice = useVoiceRecorder()',
    'voice hook'
  ],
  // Add submitVoiceStory function
  [
    'async function runPublish(',
    `async function submitVoiceStory() {
      if (!voice.recording || busy) return;
      setBusy(true);
      try {
        const res = await voice.stop(true);
        if (!res || !res.blob) { setBusy(false); return; }
        const path = "stories/" + myId + "/" + crypto.randomUUID() + ".webm";
        const { error: upErr } = await supabase.storage.from("chat-media").upload(path, res.blob, { contentType: "audio/webm" });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("chat-media").getPublicUrl(path);
        const { error: insErr } = await supabase.from("stories").insert({
          user_id: myId,
          media_url: pub?.publicUrl,
          media_type: "audio/webm",
          caption: null,
          audience: audienceMode,
        });
        if (insErr) throw insErr;
        onClose();
      } catch (e) {
        setError(e.message || String(e));
      }
      setBusy(false);
    }

    async function runPublish(`,
    'submitVoiceStory fn'
  ],
  // Add "Voice" button next to "Media" button in Text mode
  [
    `<button
            onClick={() => { setMode("media"); setTextContent("") }}
            className="h-10 px-4 rounded-full bg-black/25 text-white font-bold text-[13px]"
          >← Media</button>`,
    `<div className="flex items-center gap-2">
          <button
            onClick={() => { setMode("media"); setTextContent("") }}
            className="h-10 px-4 rounded-full bg-black/25 text-white font-bold text-[13px]"
          >← Media</button>
          <button
            onClick={() => { voice.start(); setMode("voice"); }}
            className="h-10 px-4 rounded-full bg-black/25 text-white font-bold text-[13px]"
          >🎤 Voice</button>
          </div>`,
    'text header voice button'
  ],
  // Add the Voice Mode UI block before the final return
  [
    `return createPortal(
    <div className="fixed inset-0 z-[2000] bg-black">`,
    `if (mode === "voice") {
    return createPortal(
      <div className="fixed inset-0 z-[2000] flex flex-col bg-[#0B0B14]">
        <div className="flex items-center justify-between p-4 shrink-0">
          <button onClick={() => { voice.stop(false); setMode("media"); }} className="h-10 px-4 rounded-full bg-white/10 text-white font-bold text-[13px]">← Back</button>
          <button onClick={onClose} className="w-10 h-10 rounded-full grid place-items-center bg-white/10 text-white"><X size={20} /></button>
        </div>
        <div className="flex-1 grid place-items-center">
          <div className="flex flex-col items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-red-500/20 grid place-items-center">
              <Mic size={40} className="text-red-400" />
            </div>
            <p className="text-white font-mono text-2xl">
              {Math.floor(voice.seconds / 60)}:{(voice.seconds % 60).toString().padStart(2, "0")}
            </p>
            {!voice.recording && (
              <button onClick={() => voice.start()} className="px-6 py-3 rounded-full bg-red-500 text-white font-bold">Start Recording</button>
            )}
            {voice.recording && (
              <div className="flex gap-4">
                <button onClick={() => { voice.stop(false); }} className="w-14 h-14 rounded-full bg-white/10 grid place-items-center text-white"><Trash2 size={24} /></button>
                <button onClick={submitVoiceStory} disabled={busy} className="w-14 h-14 rounded-full bg-green-500 grid place-items-center text-white disabled:opacity-50"><Send size={24} /></button>
              </div>
            )}
          </div>
        </div>
      </div>,
      document.body
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-[2000] bg-black">`,
    'voice mode UI'
  ]
]);

console.log('\nALL 3 FILES PATCHED SUCCESSFULLY');
