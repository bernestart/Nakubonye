const fs = require('fs');
const file = 'src/screens/Reels.jsx';
let content = fs.readFileSync(file, 'utf8');

// Fix the duplicate onPlay bug in the main video tag
const badVideoTag = '<video onPlay={() => trackView(r.id)} onPlay={() => trackView(reel.id)}';
const fixedVideoTag = '<video onPlay={() => trackView(reel.id)}';

// Fix the duplicate onPlay bug in the original reel video tag
const badOrigTag = '<video onPlay={() => trackView(r.id)} onPlay={() => trackView(reel.id)} src={reel.original_reel.video_url}';
const fixedOrigTag = '<video onPlay={() => trackView(reel.original_reel.id)} src={reel.original_reel.video_url}';

content = content.replace(badVideoTag, fixedVideoTag);
content = content.replace(badOrigTag, fixedOrigTag);

fs.writeFileSync(file, content);
console.log('✅ Fixed duplicate onPlay attributes in Reels.jsx');
