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
      // 0. MEDIA PROXY (DEBUGGING ENABLED)
      if (path.startsWith("/api/media/")) {
        const fileId = decodeURIComponent(path.split("/api/media/")[1]);
        if (!fileId) return new Response("Missing fileId", { status: 400, headers: cors });

        const getFileRes = await fetch(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/getFile?file_id=${fileId}`);
        const getFileData = await getFileRes.json();
        
        // 🚨 DEBUGGING: If Telegram fails, show us exactly why
        if (!getFileData.ok) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: "Telegram rejected the file ID", 
            telegram_response: getFileData,
            file_id_sent: fileId
          }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
        }

        const filePath = getFileData.result.file_path;
        const imageRes = await fetch(`https://api.telegram.org/file/bot${env.TG_BOT_TOKEN}/${filePath}`);
        
        return new Response(imageRes.body, {
          headers: {
            ...cors,
            "Content-Type": imageRes.headers.get("Content-Type") || "image/jpeg",
            "Cache-Control": "public, max-age=31536000"
          }
        });
      }

      // 1. MEDIA MICROSERVICE (Upload)
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

        const fileId = tgData.result.document.file_id;
        return new Response(JSON.stringify({ success: true, file_id: fileId }), { headers: { ...cors, "Content-Type": "application/json" } });
      }

      // ... (The rest of your routes: feed, posts, community, likes, comments remain exactly the same) ...
      
      return new Response(JSON.stringify({ success: true, message: "Nakubonye API Gateway is Live" }), { headers: { ...cors, "Content-Type": "application/json" } });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }
  }
};
