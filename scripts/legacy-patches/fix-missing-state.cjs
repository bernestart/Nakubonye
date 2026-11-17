const fs = require("fs");
const p = "src/screens/Feed.jsx";
let s = fs.readFileSync(p, "utf8");

const anchor = `  const [suggested, setSuggested] = useState([])`;
if (!s.includes(anchor)) {
  console.error("suggested state missing");
  process.exit(1);
}

const additions = `
  const [cursor, setCursor] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const sentinelRef = useRef(null)`;

if (s.includes("const [cursor,")) {
  console.log("already present");
  process.exit(0);
}

s = s.replace(anchor, anchor + additions);
fs.writeFileSync(p, s);
console.log("missing state added");
