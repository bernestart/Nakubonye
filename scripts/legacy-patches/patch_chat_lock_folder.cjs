const fs = require('fs');
const file = 'src/screens/Messages.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add State for locked chats and folder
const stateAnchor = 'const [rowMenuFor, setRowMenuFor] = useState(null)';
if (!content.includes('const [lockedChats, setLockedChats]')) {
  content = content.replace(
    stateAnchor,
    `${stateAnchor}
  const [lockedChats, setLockedChats] = useState(() => JSON.parse(localStorage.getItem('lockedChats') || '[]'))
  const [showLockedFolder, setShowLockedFolder] = useState(false)
  const [unlockFolderPrompt, setUnlockFolderPrompt] = useState(false)
  const [folderPinInput, setFolderPinInput] = useState("")
  const [savedPin, setSavedPin] = useState(() => localStorage.getItem('chatPin') || null)`
  );
}

// 2. Update Filter Logic to hide locked chats (unless in locked folder)
const filterAnchor = 'const tabFiltered = tabFilter === "all"';
const newFilter = `const getItemId = (item) => item.isGroup ? item.groupId : item.userId;
  const securedCombined = showLockedFolder 
    ? combined.filter(item => lockedChats.includes(getItemId(item)))
    : combined.filter(item => !lockedChats.includes(getItemId(item)));

  const tabFiltered = tabFilter === "all"
    ? securedCombined
    : tabFilter === "unread"
      ? securedCombined.filter((item) => item.unread)
      : tabFilter === "groups"
        ? securedCombined.filter((item) => item.isGroup)
        : securedCombined`;

if (content.includes('const tabFiltered = tabFilter === "all"')) {
  // Use regex to replace the whole tabFiltered block to avoid whitespace issues
  content = content.replace(/const tabFiltered = tabFilter === "all"[\s\S]*?: combined/, newFilter);
}

// 3. Replace the PIN Confirm button logic to actually save the lock
const oldPinLogic = `onClick={() => {
                if (pinInput.length === 4) {
                   // In a production app, you would save this lock to the database.
                   // For now, we will simulate success by closing the modal.
                   alert(pinModalFor.isLocked ? "Chat Unlocked!" : "Chat Locked!");
                   setPinModalFor(null); setPinInput("");
                }
              }}`;

const newPinLogic = `onClick={() => {
                if (pinInput.length === 4) {
                   let currentPin = localStorage.getItem('chatPin');
                   if (!currentPin) {
                     localStorage.setItem('chatPin', pinInput);
                     setSavedPin(pinInput);
                     currentPin = pinInput;
                   }
                   
                   if (pinInput === currentPin) {
                     const itemId = pinModalFor.isGroup ? pinModalFor.groupId : pinModalFor.userId;
                     let updated = [...lockedChats];
                     if (pinModalFor.isLocked) {
                       updated = updated.filter(id => id !== itemId);
                     } else {
                       updated.push(itemId);
                     }
                     setLockedChats(updated);
                     localStorage.setItem('lockedChats', JSON.stringify(updated));
                     setPinModalFor(null); setPinInput("");
                   } else {
                     alert("Incorrect PIN");
                   }
                }
              }}`;

if (content.includes('In a production app, you would save this lock')) {
  content = content.replace(oldPinLogic, newPinLogic);
}

// 4. Inject the Locked Folder Button and Unlock Prompt before the bottom padding
const folderAnchor = '<div style={{ height: 72, flexShrink: 0 }} />';
const folderUI = `{!showLockedFolder && lockedChats.length > 0 && (
        <div className="px-4 py-2">
          <button onClick={() => { if (savedPin) setUnlockFolderPrompt(true); else setShowLockedFolder(true); }} className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/10 active:bg-white/[0.06]">
            <div className="flex items-center gap-3">
              <Lock size={18} className="text-purple-400" />
              <span className="text-cream font-bold text-[14px]">Locked Chats</span>
            </div>
            <span className="text-muted text-[12px]">{lockedChats.length}</span>
          </button>
        </div>
      )}
      {showLockedFolder && (
        <div className="px-4 py-2">
           <button onClick={() => setShowLockedFolder(false)} className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/10 active:bg-white/[0.06]">
             <Unlock size={18} className="text-muted" />
             <span className="text-muted font-bold text-[14px]">Back to Main Inbox</span>
           </button>
        </div>
      )}

      {/* FOLDER UNLOCK PROMPT */}
      {unlockFolderPrompt && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/80 px-6">
          <div className="w-full max-w-[320px] bg-[#18191A] rounded-2xl p-6 flex flex-col gap-4 text-center">
            <h3 className="text-white font-bold text-[18px]">Enter PIN</h3>
            <p className="text-gray-400 text-[13px]">Enter your 4-digit PIN to view locked chats.</p>
            <input type="password" maxLength={4} value={folderPinInput} onChange={(e) => setFolderPinInput(e.target.value.replace(/[^0-9]/g, ''))} className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] text-white focus:outline-none focus:border-purple-500" placeholder="••••" autoFocus />
            <div className="flex gap-2 mt-2">
              <button onClick={() => { setUnlockFolderPrompt(false); setFolderPinInput(""); }} className="flex-1 py-3 rounded-xl bg-white/10 text-white font-bold active:bg-white/20">Cancel</button>
              <button onClick={() => {
                if (folderPinInput === savedPin) { setShowLockedFolder(true); setUnlockFolderPrompt(false); setFolderPinInput(""); }
                else alert("Incorrect PIN");
              }} disabled={folderPinInput.length !== 4} className="flex-1 py-3 rounded-xl bg-purple-600 text-white font-bold disabled:opacity-50">Unlock</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ height: 72, flexShrink: 0 }} />`;

if (!content.includes('FOLDER UNLOCK PROMPT')) {
  content = content.replace(folderAnchor, folderUI);
}

fs.writeFileSync(file, content);
console.log('✅ Successfully added Locked Folder and real PIN saving!');
