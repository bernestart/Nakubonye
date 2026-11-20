import { getAuth } from "./auth.js";
export class ChatRoomSQLite {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const upgradeHeader = request.headers.get('Upgrade');

    // 1. POST Broadcast (from API)
    if (request.method === 'POST' && upgradeHeader !== 'websocket') {
      const message = await request.text();
      // Get ALL active websockets (wakes up hibernating objects)
      const sessions = this.state.getWebSockets();
      sessions.forEach(s => {
        try { s.send(message); } catch (e) {}
      });
      return new Response("Broadcasted", { status: 200 });
    }

    // 2. WebSocket Upgrade
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // HIBERNATION API: Automatically manages sessions and memory
    this.state.acceptWebSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  // HIBERNATION EVENT: Handles incoming messages from clients
  async webSocketMessage(ws, message) {
    const sessions = this.state.getWebSockets();
    sessions.forEach(s => {
      if (s !== ws) {
        try { s.send(message); } catch (e) {}
      }
    });
  }

  // HIBERNATION EVENT: Handles cleanly closing connections
  async webSocketClose(ws, code, reason, wasClean) {
    ws.close(code, "Durable Object is closing WebSocket");
  }
  
  // HIBERNATION EVENT: Handles errors
  async webSocketError(ws, error) {
    ws.close(1011, "WebSocket error");
  }
}

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    const url = new URL(request.url);
    const path = url.pathname;
    // 0. PING ROUTE (Verification)
    if (path === "/api/ping") {
      return new Response(JSON.stringify({ ping: "pong", time: new Date().toISOString() }), { headers: cors });
    }

    // Better Auth mount
    if (path.startsWith("/api/auth/")) {
      try {
        const auth = getAuth(env);
        const res = await auth.handler(request);
        const h = new Headers(res.headers);
        h.set("Access-Control-Allow-Origin", "*");
        h.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
        h.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        return new Response(res.body, { status: res.status, headers: h });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: "AUTH_CRASH", message: err.message }), { status: 500, headers: cors });
      }
    }


    
    

    
    

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

        async function redisCommand(commandArray) {
      const res = await fetch(env.UPSTASH_REDIS_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(commandArray)
      });
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

    async function getBulkRedisLikes(postIds) {
      if (!postIds || postIds.length === 0) return {};
      try {
        // Upstash Pipeline: Send an array of commands in a single HTTP request
        const pipeline = postIds.map(id => ["SCARD", `post:likes:${id}`]);
        const redisRes = await fetch(env.UPSTASH_REDIS_URL + "/pipeline", {
          method: 'POST',
          headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(pipeline)
        });
        const redisData = await redisRes.json();
        
        // Map the results back to their post IDs
        const resultMap = {};
        postIds.forEach((id, index) => {
          resultMap[id] = redisData[index]?.result || 0;
        });
        return resultMap;
      } catch (e) { 
        console.error("Bulk Redis Error", e);
        return {}; 
      }
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
        
        // N+1 FIX: Fetch all like counts in 1 batch instead of 20 sequential requests
        const postIds = data.rows.map(p => p.post_id);
        const likesMap = await getBulkRedisLikes(postIds);
        
        const postsWithLikes = data.rows.map(post => ({
          ...post,
          likes_count: likesMap[post.post_id] || 0
        }));
        
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

      
      // 9. CREATE/UPDATE PROFILE (Onboarding)
      if (path === "/api/profile" && request.method === "POST") {
        try {
          const body = await request.json();
          const query = `
            INSERT INTO profiles (id, display_name, username, date_of_birth, gender)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (id) DO UPDATE SET 
              display_name = EXCLUDED.display_name,
              username = EXCLUDED.username,
              date_of_birth = EXCLUDED.date_of_birth,
              gender = EXCLUDED.gender
            RETURNING *;
          `;
          const params = [body.id, body.display_name, body.username, body.date_of_birth, body.gender];
          const data = await queryDatabase(query, params);
          return new Response(JSON.stringify({ success: true, data: data.rows[0] }), { headers: { ...cors, "Content-Type": "application/json" } });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: cors });
        }
      }

      
      // 10. META-SCALE BFF: Feed Bootstrap
      if (path === "/api/feed/bootstrap" && request.method === "GET") {
        try {
          const userId = url.searchParams.get("userId");
          if (!userId) throw new Error("userId required");

          // Run all independent queries in parallel for max speed
          const [
            matches, follows, blocks, mutedWords, userMutes, comments, reelLikes, listings, services, profiles
          ] = await Promise.all([
            queryDatabase(`SELECT user_one_id, user_two_id FROM matches WHERE user_one_id = $1 OR user_two_id = $1`, [userId]),
            queryDatabase(`SELECT following_id FROM follows WHERE follower_id = $1`, [userId]),
            queryDatabase(`SELECT blocker_id, blocked_id FROM blocks WHERE blocker_id = $1 OR blocked_id = $1`, [userId]),
            queryDatabase(`SELECT word FROM muted_words WHERE user_id = $1`, [userId]),
            queryDatabase(`SELECT muted_id FROM user_mutes WHERE muter_id = $1`, [userId]),
            queryDatabase(`SELECT post_id, created_at FROM user_post_comments WHERE user_id = $1 AND created_at > NOW() - INTERVAL '90 days' LIMIT 500`, [userId]),
            queryDatabase(`SELECT reel_id, created_at FROM reel_likes WHERE user_id = $1 AND created_at > NOW() - INTERVAL '90 days' LIMIT 500`, [userId]),
            queryDatabase(`SELECT id, title, price, currency, image_paths FROM listings WHERE status = 'active' ORDER BY created_at DESC LIMIT 4`),
            queryDatabase(`SELECT id, title, price, currency, duration_minutes, image_paths FROM services WHERE status = 'active' ORDER BY created_at DESC LIMIT 4`),
            queryDatabase(`SELECT id, display_name, username FROM profiles LIMIT 50`) // Fallback for PYMK
          ]);

          return new Response(JSON.stringify({
            success: true,
            data: {
              matches: matches.rows, follows: follows.rows, blocks: blocks.rows,
              mutedWords: mutedWords.rows, userMutes: userMutes.rows,
              comments: comments.rows, reelLikes: reelLikes.rows,
              listings: listings.rows, services: services.rows, profiles: profiles.rows
            }
          }), { headers: { ...cors, "Content-Type": "application/json" } });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: cors });
        }
      }

      // 11. BULK PROFILES (For likes/comments avatars)
      if (path === "/api/profiles/bulk" && request.method === "POST") {
        try {
          const { ids } = await request.json();
          if (!ids || ids.length === 0) return new Response(JSON.stringify({ success: true, data: [] }), { headers: cors });
          const placeholders = ids.map((_, i) => `${i + 1}`).join(',');
          const data = await queryDatabase(`SELECT id, display_name, username FROM profiles WHERE id IN (${placeholders})`, ids);
          return new Response(JSON.stringify({ success: true, data: data.rows }), { headers: { ...cors, "Content-Type": "application/json" } });
        } catch (err) {
          return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: cors });
        }
      }

      return new Response(JSON.stringify({ success: true, message: "Nakubonye API Gateway is Live" }), { headers: { ...cors, "Content-Type": "application/json" } });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }
  }
};
