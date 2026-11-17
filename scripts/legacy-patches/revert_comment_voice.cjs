const fs = require('fs');
const file = 'src/components/PostCommentsSheet.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove the AudioBubble component
content = content.replace(/function AudioBubble[\s\S]*?\n\}\n\n/, '');

// 2. Remove the voice hook
content = content.replace('const [text, setText] = useState("")\n  const voice = useVoiceRecorder()', 'const [text, setText] = useState("")');
content = content.replace('import { useVoiceRecorder } from "../lib/useVoiceRecorder"\n', '');

// 3. Remove the submitVoiceNote function
content = content.replace(/async function submitVoiceNote\(\) \{[\s\S]*?\n    \}\n\n    async function submit\(\) \{/, 'async function submit() {');

// 4. Revert the input bar UI
const badUI = `<div className="flex items-center gap-2">
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
            </div>`;

const goodUI = `<div className="flex items-center gap-2">
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
            </div>`;

content = content.replace(badUI, goodUI);

// Clean up unused icons just in case
content = content.replace('Send, Mic, Square, Trash2', 'Send');

fs.writeFileSync(file, content);
console.log('✅ Reverted PostCommentsSheet.jsx to text-only');
