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
      if (path === "/api/posts") {
        if (request.method === "POST") {
          const body = await request.json();
          const data = await queryDatabase(
            `INSERT INTO user_posts (user_id, content, audience) VALUES ($1, $2, 'public') RETURNING *;`,
            ["11111111-1111-1111-1111-111111111111", body.content]
          );
          return new Response(JSON.stringify({ success: true, data: data.rows[0] }), { headers: { ...cors, "Content-Type": "application/json" } });
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
      return new Response(JSON.stringify({ success: false, error: "Route not found" }), { status: 404, headers: cors });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }
  }
};
