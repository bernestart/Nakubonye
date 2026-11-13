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

    // DEBUG HELPER
    async function redisCommand(commandArray) {
      if (!env.UPSTASH_REDIS_URL) return { error: "UPSTASH_REDIS_URL is missing in Cloudflare!" };
      if (!env.UPSTASH_REDIS_TOKEN) return { error: "UPSTASH_REDIS_TOKEN is missing in Cloudflare!" };
      
      try {
        const res = await fetch(env.UPSTASH_REDIS_URL, {
          method: 'POST',
          headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(commandArray)
        });
        return await res.json();
      } catch (err) {
        return { error: "FETCH_FAILED", details: err.message };
      }
    }

    try {
      // LIKES MICROSERVICE
      if (path === "/api/likes") {
        if (request.method === "POST") {
          const body = await request.json();
          const { postId, userId, action } = body;

          if (action === 'like') {
            await redisCommand(["SADD", `post:likes:${postId}`, userId]);
          } else if (action === 'unlike') {
            await redisCommand(["SREM", `post:likes:${postId}`, userId]);
          }

          const countRes = await redisCommand(["SCARD", `post:likes:${postId}`]);
          
          // RETURN EXACTLY WHAT UPSTASH SAID
          return new Response(JSON.stringify({ 
            success: true, 
            upstash_raw_response: countRes, 
            likes: countRes.result 
          }), { headers: { ...cors, "Content-Type": "application/json" } });
        }

        if (request.method === "GET") {
          const postId = url.searchParams.get("postId");
          const countRes = await redisCommand(["SCARD", `post:likes:${postId}`]);
          return new Response(JSON.stringify({ 
            success: true, 
            upstash_raw_response: countRes, 
            likes: countRes.result 
          }), { headers: { ...cors, "Content-Type": "application/json" } });
        }
      }

      return new Response(JSON.stringify({ success: true, message: "Gateway Live" }), { headers: { ...cors, "Content-Type": "application/json" } });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }
  }
};
