const fs = require('fs');
const file = 'src/components/PostCommentsSheet.jsx';
let code = fs.readFileSync(file, 'utf8');

const oldBlock = `      const { data, error } = await supabase.from(source === "personal" ? "user_post_comments" : "community_post_comments").insert({
        post_id: postId,
        user_id: myId,
        content: body.slice(0, 800),
        reply_to_id: optimisticComment.reply_to_id,
      }).select().single();

      if (error) throw error;`;

const newBlock = `      let data, error = null;

      // META-SCALE: Personal comments go to Cloudflare, Community stays on Supabase
      if (source === "personal") {
        const res = await fetch("https://nakubonye.bernestart.workers.dev/api/comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            postId: postId,
            userId: myId,
            content: body.slice(0, 800),
            replyToId: optimisticComment.reply_to_id
          })
        });
        const json = await res.json();
        if (json.success) {
          data = json.data;
        } else {
          error = new Error(json.error);
        }
      } else {
        const supabaseRes = await supabase.from("community_post_comments").insert({
          post_id: postId,
          user_id: myId,
          content: body.slice(0, 800),
          reply_to_id: optimisticComment.reply_to_id,
        }).select().single();
        data = supabaseRes.data;
        error = supabaseRes.error;
      }

      if (error) throw error;`;

if (code.includes(oldBlock)) {
  code = code.replace(oldBlock, newBlock);
  fs.writeFileSync(file, code);
  console.log("✅ SUCCESS: PostCommentsSheet.jsx safely patched!");
} else {
  console.log("❌ ERROR: Could not find the exact insert block.");
}
