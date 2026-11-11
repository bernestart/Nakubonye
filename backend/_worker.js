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

    // Helper function to query Neon securely
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
      // 🚦 ROUTER: Directs traffic based on the URL path
      
      // 1. Route: /api/profiles (Fetch users)
      if (path === "/api/profiles") {
        const data = await queryDatabase("SELECT id, username, display_name, bio, avatar_url FROM profiles LIMIT 10;");
        return new Response(JSON.stringify({ success: true, data: data.rows }), {
          headers: { ...cors, "Content-Type": "application/json" }
        });
      }

      // 2. Route: /api/posts (Fetch feed)
      if (path === "/api/posts") {
        const data = await queryDatabase("SELECT id, content, image_path, created_at FROM user_posts ORDER BY created_at DESC LIMIT 20;");
        return new Response(JSON.stringify({ success: true, data: data.rows }), {
          headers: { ...cors, "Content-Type": "application/json" }
        });
      }

      // 3. Default Route: Health Check
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Nakubonye API Gateway is Live. Try /api/profiles or /api/posts" 
      }), {
        headers: { ...cors, "Content-Type": "application/json" }
      });

    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" }
      });
    }
  }
};
