export default {
  async fetch(request, env) {
    const cors = { "Access-Control-Allow-Origin": "*" };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    // DETECTIVE CHECK: Is the variable even there?
    if (!env.DATABASE_URL) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "DATABASE_URL is completely missing or blank in Cloudflare!" 
      }), { headers: cors });
    }

    try {
      const u = new URL(env.DATABASE_URL);
      const endpoint = `https://${u.hostname}/sql`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Neon-Connection-String": env.DATABASE_URL,
          "Neon-Array-Mode": "true"
        },
        body: JSON.stringify({ query: "SELECT 1;", params: [] })
      });
      
      const data = await res.json();
      return new Response(JSON.stringify({ success: true, data }), { headers: { ...cors, "Content-Type": "application/json" } });
      
    } catch (err) {
      // If it still fails, show us the first 15 characters and length
      return new Response(JSON.stringify({ 
        success: false, 
        error: err.message,
        debug_url_start: env.DATABASE_URL.substring(0, 15),
        debug_url_length: env.DATABASE_URL.length
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }
  }
};
