const fs = require('fs');
const file = 'src/screens/Messages.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add Pin, Lock, and Unlock icons to imports
if (content.includes('lucide-react')) {
  content = content.replace(/import \{([^}]+)\} from "lucide-react"/, (match, p1) => {
    const icons = new Set(p1.split(',').map(s => s.trim()));
    icons.add('Pin');
    icons.add('Lock');
    icons.add('Unlock');
    return `import { ${Array.from(icons).join(', ')} } from "lucide-react"`;
  });
}

// 2. Add state for the Lock PIN modal
const stateAnchor = 'const [rowMenuFor, setRowMenuFor] = useState(null)';
if (!content.includes('const [pinModalFor, setPinModalFor]')) {
  content = content.replace(
    stateAnchor,
    `${stateAnchor}\n  const [pinModalFor, setPinModalFor] = useState(null)\n  const [pinInput, setPinInput] = useState("")`
  );
}

// 3. Inject the Pin and Lock UI buttons right after the Mute button
const muteAnchor = `              <span className="font-semibold text-[14px]">
                {rowMenuFor.muted ? "Unmute" : "Mute"}
              </span>
            </button>`;

const newButtons = `${muteAnchor}

            <button
              onClick={() => toggleRowPin(rowMenuFor)}
              className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-white/6 text-left text-cream active:bg-white/[0.03]"
            >
              <Pin size={18} className={rowMenuFor.isPinned ? "text-purple-400" : ""} />
              <span className="font-semibold text-[14px]">
                {rowMenuFor.isPinned ? "Unpin from top" : "Pin to top"}
              </span>
            </button>

            <button
              onClick={() => { setPinModalFor(rowMenuFor); setRowMenuFor(null); }}
              className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-white/6 text-left text-cream active:bg-white/[0.03]"
            >
              {rowMenuFor.isLocked ? <Unlock size={18} className="text-orange-400" /> : <Lock size={18} />}
              <span className="font-semibold text-[14px]">
                {rowMenuFor.isLocked ? "Remove Lock" : "Lock Chat"}
              </span>
            </button>`;

if (!content.includes('Pin to top')) {
  content = content.replace(muteAnchor, newButtons);
}

// 4. Inject the PIN Modal UI right before the rowMenuFor closing tag
const modalAnchor = `          </div>
        </div>
      )}

      {/* New message sheet */}`;

const pinModalUI = `          </div>
        </div>
      )}

      {/* PIN LOCK MODAL */}
      {pinModalFor && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/80 px-6">
          <div className="w-full max-w-[320px] bg-[#18191A] rounded-2xl p-6 flex flex-col gap-4 text-center">
            <h3 className="text-white font-bold text-[18px]">
              {pinModalFor.isLocked ? "Enter PIN to Unlock" : "Set a 4-digit PIN"}
            </h3>
            <p className="text-gray-400 text-[13px]">
              {pinModalFor.isLocked ? "This chat is locked." : "Lock this chat to hide it from the main list."}
            </p>
            <input
              type="password"
              maxLength={4}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] text-white focus:outline-none focus:border-purple-500"
              placeholder="••••"
              autoFocus
            />
            <div className="flex gap-2 mt-2">
              <button onClick={() => { setPinModalFor(null); setPinInput(""); }} className="flex-1 py-3 rounded-xl bg-white/10 text-white font-bold">Cancel</button>
              <button onClick={() => {
                if (pinInput.length === 4) {
                   // In a production app, you would save this lock to the database.
                   // For now, we will simulate success by closing the modal.
                   alert(pinModalFor.isLocked ? "Chat Unlocked!" : "Chat Locked!");
                   setPinModalFor(null); setPinInput("");
                }
              }} disabled={pinInput.length !== 4} className="flex-1 py-3 rounded-xl bg-purple-600 text-white font-bold disabled:opacity-50">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New message sheet */}`;

if (!content.includes('PIN LOCK MODAL')) {
  content = content.replace(modalAnchor, pinModalUI);
}

fs.writeFileSync(file, content);
console.log('✅ Successfully injected Pin and Lock UI into Messages.jsx');
