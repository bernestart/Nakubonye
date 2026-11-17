const fs = require('fs');
const file = 'src/screens/Feed.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add state for the carousel
const stateAnchor = 'const [posts, setPosts] = useState([])';
if (!content.includes('suggestedReels')) {
  content = content.replace(
    stateAnchor,
    `${stateAnchor}\n  const [suggestedReels, setSuggestedReels] = useState([])`
  );
}

// 2. Replace the chronological reel fetch with the RPC call
const oldFetch = `const { data: reelRows } = await supabase
      .from("reels")
      .select("id, user_id, video_url, thumbnail_url, caption, mirrored, cover_frame_time, created_at")
      .eq("is_active", true)
      .eq("audience", "public")
      .order("created_at", { ascending: false })
      .limit(4)`;

const newFetch = `const { data: reelRows, error: reelErr } = await supabase.rpc('get_suggested_reels', {
      viewer_id: myId,
      page_limit: 10
    });
    if (!reelErr && reelRows) setSuggestedReels(reelRows);`;

if (content.includes(oldFetch)) {
  content = content.replace(oldFetch, newFetch);
} else {
  console.log('⚠️ Could not find exact oldFetch, checking for variants...');
}

// 3. Inject the Carousel UI right before the main posts map
// We insert it before <NewPostsPill or the posts.map loop
const renderAnchor = '{posts.map((p, idx) => {';
const carouselUI = `{/* SUGGESTED REELS CAROUSEL */}
            {suggestedReels.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between px-1 mb-2">
                  <h3 className="text-cream font-extrabold text-[15px]">Suggested Reels</h3>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory" style={{ scrollbarWidth: "none" }}>
                  {suggestedReels.map((reel) => (
                    <button
                      key={"reel-carousel-" + reel.id}
                      onClick={() => { tap("light"); nav("/reels/" + reel.id) }} // Update this route if your reels route is different
                      className="snap-start shrink-0 w-[120px] h-[200px] rounded-xl overflow-hidden relative bg-[#1A1A24] border border-white/10"
                    >
                      {reel.thumbnail_url ? (
                        <img src={reel.thumbnail_url} alt="" className="w-full h-full object-cover opacity-90" />
                      ) : (
                        <video src={reel.video_url} className="w-full h-full object-cover opacity-90" muted playsInline />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2">
                        <p className="text-white text-[11px] font-bold line-clamp-2 leading-tight">
                          {reel.caption || "Watch Reel"}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {posts.map((p, idx) => {`;

if (!content.includes('SUGGESTED REELS CAROUSEL')) {
  content = content.replace(renderAnchor, carouselUI);
}

fs.writeFileSync(file, content);
console.log('✅ Injected Suggested Reels Carousel into Feed.jsx');
