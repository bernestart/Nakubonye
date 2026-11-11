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
      // --- MICROSERVICE: POSTS (FEED) ---
      
      // 1. CREATE A POST (POST request)
      if (path === "/api/posts" && request.method === "POST") {
        const body = await request.json();
        
        // Insert into the database. Notice we use $1, $2 to prevent SQL injection!
        const insertQuery = `
          INSERT INTO user_posts (user_id, content, audience) 
          VALUES ($1, $2, 'public') 
          RETURNING id, content, created_at;
        `;
        
        // Using a dummy UUID for testing, later this will be the logged-in user's ID
        const dummyUserId = "00000000-0000-0000-0000-000000000000"; 
        
        const data = await queryDatabase(insertQuery, [dummyUserId, body.content]);
        
        return new Response(JSON.stringify({ 
          success: true, 
          message: "Post created successfully", 
          data: data.rows[0] 
        }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      // 2. GET THE FEED (GET request)
      if (path === "/api/posts" && request.method === "GET") {
        const data = await queryDatabase(`
          SELECT id, content, created_at 
          FROM user_posts 
          WHERE is_active = true 
          ORDER BY created_at DESC LIMIT 50;
        `);
        return new Response(JSON.stringify({ success: true, data: data.rows }), {
          headers: { ...cors, "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ success: false, error: "Route not found" }), {
        status: 404, headers: cors
      });

    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" }
      });
    }
  }
};
