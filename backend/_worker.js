export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    try {
      // We use Neon's native HTTP driver. No heavy packages needed!
      const url = new URL(env.DATABASE_URL);
      const endpoint = `https://${url.hostname}/sql`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Neon-Connection-String": env.DATABASE_URL,
          "Neon-Array-Mode": "true"
        },
        body: JSON.stringify({
          query: "SELECT 1 as test;",
          params: []
        })
      });

      const data = await res.json();

      return new Response(JSON.stringify({
        success: true,
        message: "Cloudflare Worker is officially connected to Neon!",
        data: data.rows || []
      }), {
        headers: { ...cors, "Content-Type": "application/json" }
      });

    } catch (err) {
      return new Response(JSON.stringify({
        success: false,
        error: err.message
      }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" }
      });
    }
  }
};
