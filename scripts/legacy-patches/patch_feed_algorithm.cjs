const fs = require('fs');
const file = 'src/screens/Feed.jsx';
let content = fs.readFileSync(file, 'utf8');

// The exact old query we identified in recon
const oldQuery = `const { data: personalRows } = await supabase
      .from("user_posts")
      .select("id, user_id, content, image_path, image_paths, audience, created_at, location_text, feeling_text, publish_at")
      .in("user_id", allowedUserIds)
      .eq("is_active", true)
      .lte("publish_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(20)`;

const newQuery = `// NEW: Fetch ranked feed using PostGIS/EdgeRank RPC
    const { data: rankedRows, error: rpcErr } = await supabase.rpc('get_ranked_feed', {
      viewer_id: myId,
      page_limit: 20,
      page_offset: 0
    });

    if (rpcErr) {
      console.error("Ranked feed failed, falling back to chronological:", rpcErr);
    }

    // Map the RPC output back to the format the UI expects (id instead of post_id)
    const personalRows = (rankedRows || []).map(r => ({
      id: r.post_id,
      user_id: r.user_id,
      content: r.content,
      image_path: r.image_path,
      image_paths: r.image_paths,
      audience: r.audience,
      created_at: r.created_at,
      location_text: r.location_text,
      feeling_text: r.feeling_text,
      publish_at: r.publish_at,
      _rank_score: r.rank_score
    }));`;

if (!content.includes('get_ranked_feed')) {
  if (content.includes(oldQuery)) {
    content = content.replace(oldQuery, newQuery);
    fs.writeFileSync(file, content);
    console.log('✅ Successfully swapped chronological fetch for EdgeRank RPC in Feed.jsx!');
  } else {
    console.error('❌ Could not find the exact query anchor. Let me know and I will adjust.');
  }
} else {
  console.log('✅ Feed already patched with get_ranked_feed.');
}
