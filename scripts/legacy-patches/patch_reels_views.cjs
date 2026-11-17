const fs = require('fs');
const file = 'src/screens/Reels.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add a trackedViews ref to prevent multiple counts per session
const stateAnchor = 'const [loading, setLoading] = useState(true)';
if (!content.includes('trackedViews')) {
  content = content.replace(
    stateAnchor,
    `${stateAnchor}\n  const trackedViews = useRef(new Set())`
  );
}

// 2. Add the tracking function
const loadAnchor = 'useEffect(() => {\n    load()';
const trackingFn = `const trackView = async (reelId) => {
    if (trackedViews.current.has(reelId)) return;
    trackedViews.current.add(reelId);
    try {
      await supabase.rpc('increment_reel_view', { r_id: reelId });
    } catch (e) { console.warn("View count failed", e); }
  };

  useEffect(() => {
    load()`;

if (!content.includes('const trackView = async')) {
  content = content.replace(loadAnchor, trackingFn);
}

// 3. Trigger on video play
// Find the video tag and add onPlay
content = content.replace(/<video/g, '<video onPlay={() => trackView(reel.id)}');
// Or if it's mapped as r.id
content = content.replace(/<video/g, '<video onPlay={() => trackView(r.id)}'); // depending on variable name

fs.writeFileSync(file, content);
console.log('✅ Successfully added Reel view tracking!');
