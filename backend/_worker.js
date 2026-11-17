export class ChatRoomSQLite {
  constructor(state, env) {
    this.state = state;
    this.sessions = [];
  }

  async fetch(request) {
    const upgradeHeader = request.headers.get('Upgrade');
    
    // If it's a POST, it's a broadcast from the API
    if (request.method === 'POST' && upgradeHeader !== 'websocket') {
      const message = await request.text();
      // Broadcast any type of payload (message, reaction, typing, read receipt)
      this.sessions.forEach(s => {
        try { s.send(message); } catch (e) {}
      });
      return new Response("Broadcasted", { status: 200 });
    }

    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    this.sessions.push(server);
    server.accept();

    server.addEventListener('close', () => {
      this.sessions = this.sessions.filter(s => s !== server);
    });

    server.addEventListener('message', (event) => {
      // Broadcast message to everyone else in the room
      this.sessions.forEach(s => {
        if (s !== server) {
          try { s.send(event.data); } catch (e) {}
        }
      });
    });

    return new Response(null, { status: 101, webSocket: client });
  }
}

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
      // WEBSOCKET ROUTE (Real-Time Chat)
      if (path.startsWith("/api/ws/")) {
        const roomId = path.split("/api/ws/")[1];
        const id = env.CHAT_ROOMS.idFromName(roomId);
        const obj = env.CHAT_ROOMS.get(id);
        return obj.fetch(request);
      }

      // ONLINE PRESENCE (Redis)
      if (path === "/api/presence" && request.method === "POST") {
        const body = await request.json();
        if (body.isOnline) {
          await redisCommand(["SET", `online:${body.userId}`, "true", "EX", 300]); 
        } else {
          await redisCommand(["DEL", `online:${body.userId}`]);
        }
        return new Response(JSON.stringify({ success: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      // TYPING INDICATOR (Redis)
      if (path === "/api/typing" && request.method === "POST") {
        const body = await request.json();
        if (body.isTyping) {
          await redisCommand(["SET", `typing:${body.roomId}:${body.userId}`, "true", "EX", 3]);
        } else {
          await redisCommand(["DEL", `typing:${body.roomId}:${body.userId}`]);
        }
        return new Response(JSON.stringify({ success: true }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      // BULK PRESENCE API (Privacy-Aware)
      if (path === "/api/presence/bulk" && request.method === "GET") {
        const viewerId = url.searchParams.get("viewerId");
        const idsParam = url.searchParams.get("userIds");
        if (!viewerId || !idsParam) return new Response(JSON.stringify({ success: false, error: "viewerId and userIds required" }), { status: 400, headers: cors });

        const userIds = idsParam.split(',');
        
        // 1. Fetch Privacy Settings and Last Seen from Neon
        const placeholders = userIds.map((_, i) => `${i + 1}`).join(',');
        const settingsQuery = `
          SELECT p.id, p.hide_online_status, p.last_seen_at, s.who_can_see_online
          FROM profiles p
          LEFT JOIN user_settings s ON s.user_id = p.id
          WHERE p.id IN (${placeholders})
        `;
        const settingsRes = await queryDatabase(settingsQuery, userIds);
        
        // 2. Fetch Online Status from Redis in Bulk (MGET)
        const redisKeys = userIds.map(id => `online:${id}`);
        const redisRes = await redisCommand(["MGET", ...redisKeys]);
        const redisStatuses = redisRes.result || [];

        // 3. Combine and enforce Privacy
        const result = {};
        userIds.forEach((id, index) => {
          const dbRow = settingsRes.rows.find(r => r.id === id) || {};
          const isOnlineInRedis = redisStatuses[index] === "true";
          
          let canSee = true;
          if (dbRow.hide_online_status) canSee = false;
          if (dbRow.who_can_see_online === 'nobody') canSee = false;
          // Note: 'matches' logic can be added later by checking the matches table

          if (canSee) {
            result[id] = { is_online: isOnlineInRedis, last_seen_at: dbRow.last_seen_at };
          } else {
            result[id] = { is_online: false, last_seen_at: null }; // Hidden
          }
        });

        return new Response(JSON.stringify({ success: true, data: result }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

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
        try {
          const MAX_BYTES = 20 * 1024 * 1024;
          const contentLength = Number(request.headers.get("content-length") || 0);
          if (contentLength > MAX_BYTES + 512 * 1024) {
            return new Response(JSON.stringify({ success: false, error: `File too large. Max 20MB (got ${(contentLength / 1024 / 1024).toFixed(1)}MB).` }), { status: 413, headers: { ...cors, "Content-Type": "application/json" } });
          }

          const formData = await request.formData();
          const file = formData.get("file");
          if (!file) return new Response(JSON.stringify({ success: false, error: "No file provided" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

          if (typeof file.size === "number" && file.size > MAX_BYTES) {
            return new Response(JSON.stringify({ success: false, error: `File too large. Max 20MB (got ${(file.size / 1024 / 1024).toFixed(1)}MB).` }), { status: 413, headers: { ...cors, "Content-Type": "application/json" } });
          }

          const tgFormData = new FormData();
          tgFormData.append("chat_id", env.TG_CHAT_ID);
          tgFormData.append("document", file);

          const tgRes = await fetch(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/sendDocument`, { method: "POST", body: tgFormData });
          const tgData = await tgRes.json();
          if (!tgData.ok) throw new Error(tgData.description || "Telegram upload failed");

          return new Response(JSON.stringify({ success: true, file_id: tgData.result.document.file_id }), { headers: { ...cors, "Content-Type": "application/json" } });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message || "Upload failed" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
        }
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

      // 4.5 DIRECT MESSAGES (DM)
      if (path === "/api/messages" && request.method === "POST") {
        const body = await request.json();
        const insertQuery = `
          INSERT INTO messages (conversation_id, sender_id, content, media_url, media_type, media_name, reply_to_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;
        `;
        const data = await queryDatabase(insertQuery, [
          body.conversation_id, body.sender_id, body.content, body.media_url, body.media_type, body.media_name, body.reply_to_id
        ]);
        
        const newMsg = data.rows[0];
        // Broadcast to DM WebSocket
        try {
          const id = env.CHAT_ROOMS.idFromName("dm-" + body.conversation_id);
          const obj = env.CHAT_ROOMS.get(id);
          await obj.fetch("https://dummy.com/", { method: "POST", body: JSON.stringify(newMsg) });
        } catch (e) { console.error(e); }

        return new Response(JSON.stringify({ success: true, data: newMsg }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      // 4.6 GROUP MESSAGES
      if (path === "/api/group/messages" && request.method === "POST") {
        const body = await request.json();
        const insertQuery = `
          INSERT INTO group_messages (group_id, sender_id, content, media_url, media_type, media_name, reply_to_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;
        `;
        const data = await queryDatabase(insertQuery, [
          body.group_id, body.sender_id, body.content, body.media_url, body.media_type, body.media_name, body.reply_to_id
        ]);
        
        const newMsg = data.rows[0];
        // Broadcast to Group WebSocket
        try {
          const id = env.CHAT_ROOMS.idFromName("group-" + body.group_id);
          const obj = env.CHAT_ROOMS.get(id);
          await obj.fetch("https://dummy.com/", { method: "POST", body: JSON.stringify(newMsg) });
        } catch (e) { console.error(e); }

        return new Response(JSON.stringify({ success: true, data: newMsg }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      // 5. COMMUNITY MESSAGES (CHAT)
      if (path === "/api/community/messages") {
        if (request.method === "POST") {
          const body = await request.json();
          const insertQuery = `
            INSERT INTO community_messages (community_id, sender_id, content, media_url, media_type, media_name, voice_duration_seconds) 
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;
          `;
          const data = await queryDatabase(insertQuery, [
            body.communityId, body.senderId, body.content, body.mediaUrl, body.mediaType, body.mediaName, body.voiceDuration
          ]);
          
          const newMessage = data.rows[0];
          newMessage.display_name = "User"; // Placeholder, you can join profiles later
          
          // META-SCALE: Broadcast to WebSocket Room
          try {
            const roomId = body.communityId.toString();
            const id = env.CHAT_ROOMS.idFromName(roomId);
            const obj = env.CHAT_ROOMS.get(id);
            await obj.fetch("https://dummy.com/", {
              method: "POST",
              body: JSON.stringify(newMessage)
            });
          } catch (wsErr) {
            console.error("Broadcast failed", wsErr);
          }

          return new Response(JSON.stringify({ success: true, data: newMessage }), { headers: { ...cors, "Content-Type": "application/json" } });
        }
        if (request.method === "GET") {
          const communityId = url.searchParams.get("communityId");
          if (!communityId) return new Response(JSON.stringify({ success: false, error: "communityId required" }), { status: 400, headers: cors });
          
          const data = await queryDatabase(`
            SELECT m.*, p.display_name, p.username 
            FROM community_messages m
            LEFT JOIN profiles p ON p.id = m.sender_id
            WHERE m.community_id = $1 AND m.deleted_at IS NULL
            ORDER BY m.created_at ASC LIMIT 50
          `, [communityId]);

          return new Response(JSON.stringify({ success: true, data: data.rows }), { headers: { ...cors, "Content-Type": "application/json" } });
        }
      }

      // 6. LIKES
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

      // 7. LIKES LIST
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

      // 8. COMMENTS
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
