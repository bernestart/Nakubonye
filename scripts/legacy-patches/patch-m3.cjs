#!/usr/bin/env node
const fs = require('fs');

let ok = true;
const srcCache = {};

function load(file) {
  if (!srcCache[file]) srcCache[file] = fs.readFileSync(file, 'utf8');
  return srcCache[file];
}

function save(file) {
  fs.writeFileSync(file, srcCache[file]);
  console.log(`\u2705 Applied changes to ${file}`);
}

// --- M3a. ExpandableText -> HashtagText ---
const ET = 'src/components/ExpandableText.jsx';
load(ET);
if (!srcCache[ET].includes('import HashtagText')) {
  srcCache[ET] = srcCache[ET].replace(/(import .*?\n)/, '$1import HashtagText from "./HashtagText"\n');
  console.log('✅ ET import');
}
// Wrap the old return with HashtagText (using regex to find the start of return)
srcCache[ET] = srcCache[ET].replace(/return\s*\(\s*<p/, 'return (\n    <HashtagText text={text} className={className} />\n  )\n  return (\n    <p');
console.log('✅ ET wrap');
save(ET);

// --- M3b. CreatorMode -> Dashboard ---
const CM = 'src/screens/CreatorMode.jsx';
load(CM);
if (!srcCache[CM].includes('import CreatorDashboard')) {
  // Inject after the first import statement
  srcCache[CM] = srcCache[CM].replace(/(import .*?\n)/, '$1import CreatorDashboard from "../components/CreatorDashboard"\n');
  console.log('✅ CM import');
}
if (!srcCache[CM].includes('const [dashOpen, setDashOpen]')) {
  srcCache[CM] = srcCache[CM].replace(/(const \[loading, setLoading\] = useState\(true\))/, '$1\n  const [dashOpen, setDashOpen] = useState(false)');
  console.log('✅ CM state');
}
if (!srcCache[CM].includes('{dashOpen && <CreatorDashboard')) {
  // Inject before the main content container
  srcCache[CM] = srcCache[CM].replace(/(<div className="max-w-\[480px\] mx-auto px-5 py-5">)/, '{dashOpen && <CreatorDashboard onClose={() => setDashOpen(false)} />}\n      $1');
  console.log('✅ CM render dashboard');
}
if (!srcCache[CM].includes('View Dashboard')) {
  srcCache[CM] = srcCache[CM].replace(/(<div className="flex flex-col gap-3 mb-6">)/, `<button onClick={() => setDashOpen(true)} className="w-full flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 mb-4 text-left">
        <div>
          <p className="text-cream font-bold text-[15px]">View Dashboard</p>
          <p className="text-purple-300 text-[12px]">See your reach, likes, and comments</p>
        </div>
        <span className="text-purple-300 text-[20px]">→</span>
      </button>
      $1`);
  console.log('✅ CM button');
}
save(CM);

// --- M3c. PostActionsSheet -> View Insights ---
const PAS = 'src/components/PostActionsSheet.jsx';
load(PAS);
if (!srcCache[PAS].includes('import PostInsights')) {
  srcCache[PAS] = srcCache[PAS].replace(/(import .*?\n)/, '$1import PostInsights from "./PostInsights"\n');
  // Add BarChart2 to lucide imports safely
  srcCache[PAS] = srcCache[PAS].replace(/(import \{.*?)\} from "lucide-react"/, '$1, BarChart2 } from "lucide-react"');
  console.log('✅ PAS import');
}
if (!srcCache[PAS].includes('const [insightsOpen')) {
  srcCache[PAS] = srcCache[PAS].replace(/(const \[screen, setScreen\] = useState\("menu"\))/, '$1\n  const [insightsOpen, setInsightsOpen] = useState(false)');
  console.log('✅ PAS state');
}
if (!srcCache[PAS].includes('View insights')) {
  // Inject before the Edit post button
  srcCache[PAS] = srcCache[PAS].replace(/(\{isMine && isPersonal && \(\s*<button\s*onClick=\{\(\) => setScreen\("edit"\)\})/, `{isMine && isPersonal && (
                <button
                  onClick={() => setInsightsOpen(true)}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-white/[0.04] border border-white/8 text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 grid place-items-center">
                    <BarChart2 size={17} className="text-purple-300" />
                  </div>
                  <div className="flex-1">
                    <p className="text-cream font-semibold text-[14.5px]">View insights</p>
                    <p className="text-muted text-[12px]">See reach and engagement</p>
                  </div>
                </button>
              )}

              $1`);
  console.log('✅ PAS insights button');
}
if (!srcCache[PAS].includes('{insightsOpen && <PostInsights')) {
  // Inject at the start of the return statement
  srcCache[PAS] = srcCache[PAS].replace(/(return \(\s*<div className="fixed inset-0 z-\[400\] flex items-end" onClick=\{onClose\}>)/, `return (
      <>
      {insightsOpen && <PostInsights post={post} onClose={() => setInsightsOpen(false)} />}
      $1`);
  // Close the fragment at the end
  srcCache[PAS] = srcCache[PAS].replace(/(<\/div>\s*\)\s*\}\s*)$/, '</div>\n      </>\n    )\n  }\n');
  console.log('✅ PAS render insights');
}
save(PAS);

// --- M3d. PostDetail -> Log View ---
const PD = 'src/screens/PostDetail.jsx';
load(PD);
if (!srcCache[PD].includes('post_views')) {
  srcCache[PD] = srcCache[PD].replace(/(const \[loading, setLoading\] = useState\(true\))/, `$1
  useEffect(() => {
    if (post && myId) {
      supabase.from("post_views").upsert({ post_id: String(post.id), post_source: post._source, viewer_id: myId }, { onConflict: "post_id, post_source, viewer_id" }).then(() => {})
    }
  }, [post?.id, myId])`);
  console.log('✅ PD log view');
}
save(PD);

console.log('\n✅ Done. Patch complete.');
