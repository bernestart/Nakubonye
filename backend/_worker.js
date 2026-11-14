export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    const url = new URL(request.url);
    const path = url.pathname;

    async function queryDatabase(sqlQuery, params = []) {
      const dbUrl = new URL(env.DATABASE_URL);
      const endpoint = `https://${dbUrl.hostname}/sql`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Neon-Connection-String": env.DATABASE_URL },
        body: JSON.stringify({ query: sqlQuery, params: params })
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    }

    async function getRedisLikes(postId) {
      try {
        const redisRes = await fetch(env.UPSTASH_REDIS_URL, {
          method: 'POST',
          headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(["SCARD", `post:likes:${postId}`])
        });
        const redisData = await redisRes.json();
        return redisData.result || 0;
      } catch (e) { return 0; }
    }

    try {
      // 0. MEDIA PROXY
      if (path.startsWith("/api/media/")) {
        const fileId = decodeURIComponent(path.split("/api/media/")[1]);
        if (!fileId) return new Response("Missing fileId", { status: 400, headers: cors });

        const getFileRes = await fetch(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/getFile?file_id=${fileId}`);
        const getFileData = await getFileRes.json();
        
        if (!getFileData.ok) {
          return new Response(JSON.stringify({ error: "Telegram rejected ID", details: getFileData }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
        }

        const filePath = getFileData.result.file_path;
        const imageRes = await fetch(`https://api.telegram.org/file/bot${env.TG_BOT_TOKEN}/${filePath}`);
        
        return new Response(imageRes.body, {
          headers: { ...cors, "Content-Type": imageRes.headers.get("Content-Type") || "image/jpeg", "Cache-Control": "public, max-age=31536000" }
        });
      }

      // 1. UPLOAD
      if (path === "/api/upload" && request.method === "POST") {
        const formData = await request.formData();
        const file = formData.get("file");
        if (!file) return new Response(JSON.stringify({ success: false, error: "No file provided" }), { status: 400, headers: cors });

        const tgFormData = new FormData();
        tgFormData.append("chat_id", env.TG_CHAT_ID);
        tgFormData.append("document", file); 

        const tgRes = await fetch(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/sendDocument`, { method: "POST", body: tgFormData });
        const tgData = await tgRes.json();
        if (!tgData.ok) throw new Error(tgData.description || "Telegram upload failed");

        return new Response(JSON.stringify({ success: true, file_id: tgData.result.document.file_id }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      // 2. GET RANKED FEED
      if (path === "/api/feed" && request.method === "GET") {
        const userId = url.searchParams.get("userId");
        const limit = url.searchParams.get("limit") || 20;
        const offset = url.searchParams.get("offset") || 0;
        if (!userId) return new Response(JSON.stringify({ success: false, error: "userId required" }), { status: 400, headers: cors });

        const data = await queryDatabase(`SELECT * FROM get_ranked_feed($1::uuid, $2::integer, $3::integer)`, [userId, limit, offset]);
        const postsWithLikes = [];
        for (const post of data.rows) {
          const likesCount = await getRedisLikes(post.post_id);
          postsWithLikes.push({ ...post, likes_count: likesCount });
        }
        return new Response(JSON.stringify({ success: true, data: postsWithLikes }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      // 3. POSTS (Personal)
      if (path === "/api/posts") {
        if (request.method === "POST") {
          const body = await request.json();
          const insertQuery = `
            INSERT INTO user_posts (user_id, content, image_path, image_paths, audience, reshared_from_type, reshared_from_id, reshared_from_snapshot, reshared_include_original, location_text, location, feeling_text, publish_at, who_can_comment, ai_label, share_to_story, tagged_user_ids, background_style, image_alts) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::geography, $12, $13, $14, $15, $16, $17, $18, $19) RETURNING *; 
          `;
          const params = [body.user_id, body.content, body.image_path, body.image_paths || [], body.audience || 'public', body.reshared_from_type, body.reshared_from_id, body.reshared_from_snapshot ? JSON.stringify(body.reshared_from_snapshot) : null, body.reshared_include_original, body.location_text, body.location, body.feeling_text, body.publish_at, body.who_can_comment, body.ai_label, body.share_to_story, body.tagged_user_ids || [], body.background_style, body.image_alts ? JSON.stringify(body.image_alts) : null];
          const data = await queryDatabase(insertQuery, params);
          return new Response(JSON.stringify({ success: true, data: data.rows[0] }), { headers: { ...cors, "Content-Type": "application/json" } });
        }

        if (request.method === "GET") {
          const singlePostId = url.searchParams.get("id");
          if (singlePostId) {
            const data = await queryDatabase(`SELECT * FROM user_posts WHERE id = $1`, [singlePostId]);
            if (data.rows.length === 0) return new Response(JSON.stringify({ success: false, error: "Not found" }), { status: 404, headers: cors });
            const likesCount = await getRedisLikes(singlePostId);
            return new Response(JSON.stringify({ success: true, data: { ...data.rows[0], likes_count: likesCount } }), { headers: { ...cors, "Content-Type": "application/json" } });
          }

          const userId = url.searchParams.get("userId");
          let query = `SELECT id, content, image_path, created_at, audience, user_id FROM user_posts WHERE is_active = true`;
          let params = [];
          if (userId) { query += ` AND user_id = $1`; params.push(userId); }
          query += ` ORDER BY created_at DESC LIMIT 60`;
          const data = await queryDatabase(query, params);
          
          const postsWithLikes = [];
          for (const post of data.rows) {
            const likesCount = await getRedisLikes(post.id);
            postsWithLikes.push({ ...post, likes_count: likesCount });
          }
          return new Response(JSON.stringify({ success: true, data: postsWithLikes }), { headers: { ...cors, "Content-Type": "application/json" } });
        }
      }

      // 4. COMMUNITY POSTS
      if (path === "/api/community/posts" && request.method === "GET") {
        const singlePostId = url.searchParams.get("id");
        if (singlePostId) {
          const data = await queryDatabase(`SELECT * FROM community_posts WHERE id = $1 AND deleted_at IS NULL`, [singlePostId]);
          if (data.rows.length === 0) return new Response(JSON.stringify({ success: false, error: "Not found" }), { status: 404, headers: cors });
          const likesCount = await getRedisLikes(singlePostId);
          return new Response(JSON.stringify({ success: true, data: { ...data.rows[0], likes_count: likesCount } }), { headers: { ...cors, "Content-Type": "application/json" } });
        }

        const idsParam = url.searchParams.get("communityIds");
        const userId = url.searchParams.get("userId"); 
        if (!idsParam || !userId) return new Response(JSON.stringify({ success: false, error: "communityIds and userId required" }), { status: 400, headers: cors });

        const communityIds = idsParam.split(',').map(Number);
        const data = await queryDatabase(`
          SELECT cp.id, cp.author_id, cp.community_id, cp.content, cp.image_path, cp.image_paths, cp.created_at, cp.pinned_until, cp.is_announcement
          FROM community_posts cp
          JOIN community_memberships cm ON cm.community_id = cp.community_id
          WHERE cp.community_id = ANY($1::bigint[]) 
            AND cp.deleted_at IS NULL
            AND cm.user_id = $2 
          ORDER BY cp.created_at DESC LIMIT 30
        `, [communityIds, userId]);

        const postsWithLikes = [];
        for (const post of data.rows) {
          const likesCount = await getRedisLikes(post.id);
          postsWithLikes.push({ ...post, likes_count: likesCount });
        }
        return new Response(JSON.stringify({ success: true, data: postsWithLikes }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      // 5. LIKES
      if (path === "/api/likes") {
        const redisCommand = async (commandArray) => {
          const res = await fetch(env.UPSTASH_REDIS_URL, {
            method: 'POST',
            headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(commandArray)
          });
          return await res.json();
        };
        if (request.method === "POST") {
          const body = await request.json();
          const { postId, userId, action } = body;
          if (action === 'like') await redisCommand(["SADD", `post:likes:${postId}`, userId]);
          else if (action === 'unlike') await redisCommand(["SREM", `post:likes:${postId}`, userId]);
          const countRes = await redisCommand(["SCARD", `post:likes:${postId}`]);
          return new Response(JSON.stringify({ success: true, likes: countRes.result }), { headers: { ...cors, "Content-Type": "application/json" } });
        }
        if (request.method === "GET") {
          const postId = url.searchParams.get("postId");
          const countRes = await redisCommand(["SCARD", `post:likes:${postId}`]);
          return new Response(JSON.stringify({ success: true, likes: countRes.result }), { headers: { ...cors, "Content-Type": "application/json" } });
        }
      }

      // 6. LIKES LIST
      if (path === "/api/likes/list" && request.method === "GET") {
        const postId = url.searchParams.get("postId");
        const redisRes = await fetch(env.UPSTASH_REDIS_URL, {
          method: 'POST',
          headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(["SMEMBERS", `post:likes:${postId}`])
        });
        const redisData = await redisRes.json();
        const userIds = redisData.result || [];

        if (userIds.length === 0) return new Response(JSON.stringify({ success: true, data: [] }), { headers: { ...cors, "Content-Type": "application/json" } });

        const placeholders = userIds.map((_, i) => `$${i + 1}`).join(',');
        const profiles = await queryDatabase(`SELECT id, display_name, username FROM profiles WHERE id IN (${placeholders})`, userIds);
        return new Response(JSON.stringify({ success: true, data: profiles.rows }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      // 7. COMMENTS
      if (path === "/api/comments") {
        if (request.method === "POST") {
          const body = await request.json();
          const insertQuery = `INSERT INTO user_post_comments (post_id, user_id, content, reply_to_id) VALUES ($1, $2, $3, $4) RETURNING id, content, created_at, user_id, reply_to_id;`;
          const data = await queryDatabase(insertQuery, [body.postId, body.userId, body.content, body.replyToId || null]);
          return new Response(JSON.stringify({ success: true, data: data.rows[0] }), { headers: { ...cors, "Content-Type": "application/json" } });
        }
        if (request.method === "GET") {
          const postId = url.searchParams.get("postId");
          const data = await queryDatabase(`SELECT c.id, c.content, c.created_at, c.user_id, c.reply_to_id, p.display_name, p.username FROM user_post_comments c LEFT JOIN profiles p ON p.id = c.user_id WHERE c.post_id = $1 AND c.deleted_at IS NULL ORDER BY c.created_at ASC;`, [postId]);
          return new Response(JSON.stringify({ success: true, data: data.rows }), { headers: { ...cors, "Content-Type": "application/json" } });
        }
      }

      return new Response(JSON.stringify({ success: true, message: "Nakubonye API Gateway is Live" }), { headers: { ...cors, "Content-Type": "application/json" } });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }
  }
};
