const fs = require("fs");
const p = "src/screens/Messages.jsx";
let s = fs.readFileSync(p, "utf8");

// Add imports
const importAnchor = `import AppHeader from "../components/AppHeader"`;
if (!s.includes(importAnchor)) { console.error("AppHeader import missing"); process.exit(1); }
if (!s.includes("PenSquare")) {
  // Check existing lucide imports
  const lucideMatch = s.match(/import \{([^}]+)\} from ['"]lucide-react['"]/);
  if (lucideMatch) {
    s = s.replace(lucideMatch[0], lucideMatch[0].replace("}", ", PenSquare }"));
  } else {
    console.error("no lucide import");
    process.exit(1);
  }
}

// Add state for new-message sheet
const stateAnchor = `  const [loading, setLoading] = useState(true)`;
if (!s.includes(stateAnchor)) { console.error("loading state missing"); process.exit(1); }
if (!s.includes("newMsgOpen")) {
  s = s.replace(stateAnchor, stateAnchor + `\n  const [newMsgOpen, setNewMsgOpen] = useState(false)\n  const [allUsers, setAllUsers] = useState([])`);
}

// Insert header row after <AppHeader />
const headerAnchor = `      <AppHeader />`;
if (!s.includes(headerAnchor)) { console.error("AppHeader render missing"); process.exit(1); }
if (!s.includes("Messages list header")) {
  s = s.replace(headerAnchor, `      <AppHeader />

      {/* Messages header */}
      <div className="px-4 pt-2 pb-3 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-cream text-[22px] font-extrabold tracking-tight">
            Messages
          </h1>
          <p className="text-muted text-[12.5px] mt-0.5">
            {items.length === 0 ? "No conversations yet" : items.length + (items.length === 1 ? " conversation" : " conversations")}
          </p>
        </div>
        <button
          onClick={() => { tap("light"); setNewMsgOpen(true) }}
          className="w-10 h-10 rounded-full grid place-items-center active:scale-95 transition-transform"
          style={{
            background: "linear-gradient(135deg, #EC4899 0%, #A855F7 100%)",
            boxShadow: "0 6px 18px rgba(236,72,153,0.45)",
          }}
          aria-label="New message"
        >
          <PenSquare size={18} color="#fff" />
        </button>
      </div>`);
}

fs.writeFileSync(p, s);
console.log("messages header added");
