const fs = require("fs");
const p = "src/screens/Feed.jsx";
let s = fs.readFileSync(p, "utf8");

const anchor = `  const [reelsRail, setReelsRail] = useState([])`;
const idx = s.indexOf(anchor);
if (idx < 0) {
  console.error("anchor not found");
  process.exit(1);
}

const additions = `
  const [myReactions, setMyReactions] = useState(new Set())
  const [reactionCounts, setReactionCounts] = useState(new Map())
  const [commentCounts, setCommentCounts] = useState(new Map())
  const [commentsFor, setCommentsFor] = useState(null)
  const [suggested, setSuggested] = useState([])`;

// Check if any of these already exist
if (s.includes("const [myReactions")) {
  console.log("already present");
  process.exit(0);
}

const insertAt = idx + anchor.length;
s = s.slice(0, insertAt) + additions + s.slice(insertAt);
fs.writeFileSync(p, s);
console.log("state vars added");
