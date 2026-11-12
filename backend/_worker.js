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
        headers: {
          "Content-Type": "application/json",
          "Neon-Connection-String": env.DATABASE_URL,
          "Neon-Array-Mode": "true"
        },
        body: JSON.stringify({ query: sqlQuery, params: params })
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    }

    try {
      // 1. GET RANKED FEED
      if (path === "/api/feed" && request.method === "GET") {
        const userId = url.searchParams.get("userId");
        const limit = url.searchParams.get("limit") || 20;
        const offset = url.searchParams.get("offset") || 0;
        
        if (!userId) {
          return new Response(JSON.stringify({ success: false, error: "userId is required" }), { status: 400, headers: cors });
        }

        const data = await queryDatabase(
          `SELECT * FROM get_ranked_feed($1::uuid, $2::integer, $3::integer)`,
          [userId, limit, offset]
        );

        return new Response(JSON.stringify({ success: true, data: data.rows }), {
          headers: { ...cors, "Content-Type": "application/json" }
        });
      }

      // 2. POSTS (CREATE & GET)
      if (path === "/api/posts") {
        if (request.method === "POST") {
          const body = await request.json();
          
          const insertQuery = `
            INSERT INTO user_posts (
              user_id, content, image_path, image_paths, audience,
              reshared_from_type, reshared_from_id, reshared_from_snapshot,
              reshared_include_original, location_text, location,
              feeling_text, publish_at, who_can_comment, ai_label,
              share_to_story, tagged_user_ids, background_style, image_alts
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::geography, $12, $13, $14, $15, $16, $17, $18, $19
            ) RETURNING *; 
          `;

          const params = [
            body.user_id, body.content, body.image_path, body.image_paths || [], 
            body.audience || 'public', body.reshared_from_type, body.reshared_from_id, 
            body.reshared_from_snapshot ? JSON.stringify(body.reshared_from_snapshot) : null, 
            body.reshared_include_original, body.location_text, body.location, 
            body.feeling_text, body.publish_at, body.who_can_comment, body.ai_label, 
            body.share_to_story, body.tagged_user_ids || [], body.background_style, 
            body.image_alts ? JSON.stringify(body.image_alts) : null
          ];

          const data = await queryDatabase(insertQuery, params);
          return new Response(JSON.stringify({ success: true, data: data.rows[0] }), { 
            headers: { ...cors, "Content-Type": "application/json" } 
          });
        }

        if (request.method === "GET") {
          const userId = url.searchParams.get("userId");
          let query = `SELECT id, content, image_path, created_at, audience, user_id FROM user_posts WHERE is_active = true`;
          let params = [];
          
          if (userId) {
            query += ` AND user_id = $1`;
            params.push(userId);
          }
          query += ` ORDER BY created_at DESC LIMIT 60`;

          const data = await queryDatabase(query, params);
          return new Response(JSON.stringify({ success: true, data: data.rows }), {
            headers: { ...cors, "Content-Type": "application/json" }
          });
        }
      }

      // 3. DEFAULT / HEALTH CHECK
      return new Response(JSON.stringify({ success: true, message: "Nakubonye API Gateway is Live" }), {
        headers: { ...cors, "Content-Type": "application/json" }
      });

    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" }
      });
    }
  }
};
