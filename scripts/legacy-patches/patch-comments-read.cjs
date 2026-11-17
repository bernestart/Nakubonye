const fs = require('fs');
const file = 'src/components/PostCommentsSheet.jsx';
let code = fs.readFileSync(file, 'utf8');

// Find the load function
const oldLoadBlock = `    const load = useCallback(async () => {
    setLoading(true)
    const { data: rows } = await supabase
      .from(table)
      .select("id, user_id, content, created_at, reply_to_id, edited_at, deleted_at, pinned_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .limit(50)

    const list = (rows || []).slice().sort((a, b) => {
      if (a.pinned_at && !b.pinned_at) return -1
      if (b.pinned_at && !a.pinned_at) return 1
      return new Date(a.created_at) - new Date(b.created_at)
    })`;

// The new load function
const newLoadBlock = `    const load = useCallback(async () => {
    setLoading(true)
    
    // META-SCALE: Fetch personal comments from Cloudflare
    if (source === "personal") {
      try {
        const res = await fetch(\`https://nakubonye.bernestart.workers.dev/api/comments?postId=\${postId}\`);
        const json = await res.json();
        if (json.success) {
          const list = json.data.slice().sort((a, b) => {
            return new Date(a.created_at) - new Date(b.created_at);
          });
          setComments(list);
          onCountChangeRef.current?.(list.filter((c) => !c.deleted_at).length);
          setLoading(false);
          return;
        }
      } catch (e) {
        console.error("Failed to load Cloudflare comments", e);
      }
    }

    // Fallback to Supabase for community comments
    const { data: rows } = await supabase
      .from(commentTable)
      .select("id, user_id, content, created_at, reply_to_id, edited_at, deleted_at, pinned_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .limit(50)

    const list = (rows || []).slice().sort((a, b) => {
      if (a.pinned_at && !b.pinned_at) return -1
      if (b.pinned_at && !a.pinned_at) return 1
      return new Date(a.created_at) - new Date(b.created_at)
    })`;

if (code.includes(oldLoadBlock)) {
  code = code.replace(oldLoadBlock, newLoadBlock);
  fs.writeFileSync(file, code);
  console.log("✅ SUCCESS: PostCommentsSheet.jsx now fetches from Cloudflare!");
} else {
  // Fallback if spacing is slightly different
  const regex = /const load = useCallback\(async \(\) => \{\s*setLoading\(true\)\s*const \{ data: rows \} = await supabase[\s\S]*?return new Date\(a\.created_at\) - new Date\(b\.created_at\)\s*\}\)/;
  if (regex.test(code)) {
    code = code.replace(regex, newLoadBlock);
    fs.writeFileSync(file, code);
    console.log("✅ SUCCESS: PostCommentsSheet.jsx patched (Regex fallback)!");
  } else {
    console.log("❌ ERROR: Could not find the load function in PostCommentsSheet.jsx.");
  }
}
