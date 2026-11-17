const fs = require("fs");
const p = "src/screens/Feed.jsx";
let s = fs.readFileSync(p, "utf8");

const anchor = `  const [reelsRail, setReelsRail] = useState([])`;
if (!s.includes(anchor)) {
  console.error("reelsRail anchor missing");
  process.exit(1);
}

const additions = `  const [myReactions, setMyReactions] = useState(new Set())
  const [reactionCounts, setReactionCounts] = useState(new Map())
  const [commentCounts, setCommentCounts] = useState(new Map())
  const [commentsFor, setCommentsFor] = useState(null)
  const [suggested, setSuggested] = useState([])`;

if (!s.includes("myReactions")) {
  s = s.replace(anchor, anchor + "\n" + additions);
  fs.writeFileSync(p, s);
  console.log("state vars restored");
} else {
  console.log("state vars already present");
}
