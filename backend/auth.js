import { betterAuth } from "better-auth";
import { bearer, emailOTP } from "better-auth/plugins";

const MODEL_TO_TABLE = { user: "user", session: "session", account: "account", verification: "verification" };
const AUTH_CACHE = new Map();

function createNeonAdapter(env) {
  const q = async (sql, params = []) => {
    const dbUrl = new URL(env.DATABASE_URL);
    const endpoint = `https://${dbUrl.hostname}/sql`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Neon-Connection-String": env.DATABASE_URL },
      body: JSON.stringify({ query: sql, params: params })
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  };

  const buildWhere = (where, startIdx) => where.map((w, i) => {
    const col = `"${w.field}"`;
    const ph = `$${startIdx + i}`;
    const op = w.operator || "eq";
    switch (op) {
      case "eq": return `${col} = ${ph}`;
      case "ne": return `${col} != ${ph}`;
      case "gt": return `${col} > ${ph}`;
      case "lt": return `${col} < ${ph}`;
      case "gte": return `${col} >= ${ph}`;
      case "lte": return `${col} <= ${ph}`;
      case "in": return `${col} = ANY(${ph})`;
      case "contains": return `${col} LIKE '%' || ${ph} || '%'`;
      case "starts_with": return `${col} LIKE ${ph} || '%'`;
      case "ends_with": return `${col} LIKE '%' || ${ph}`;
      default: throw new Error(`Unsupported operator: ${op}`);
    }
  }).join(" AND ");

  return {
    async create({ model, data }) {
      const table = MODEL_TO_TABLE[model];
      const fields = Object.keys(data);
      const ph = fields.map((_, i) => `$${i + 1}`).join(", ");
      const cols = fields.map(f => `"${f}"`).join(", ");
      const res = await q(`INSERT INTO "${table}" (${cols}) VALUES (${ph}) RETURNING *`, fields.map(f => data[f]));
      return res.rows[0];
    },
    async findOne({ model, where }) {
      const table = MODEL_TO_TABLE[model];
      const res = await q(`SELECT * FROM "${table}" WHERE ${buildWhere(where, 1)} LIMIT 1`, where.map(w => w.value));
      return res.rows[0] || null;
    },
    async findMany({ model, where = [], limit, offset }) {
      const table = MODEL_TO_TABLE[model];
      const w = where.length ? `WHERE ${buildWhere(where, 1)}` : "";
      const l = limit ? `LIMIT ${limit}` : "";
      const o = offset ? `OFFSET ${offset}` : "";
      const res = await q(`SELECT * FROM "${table}" ${w} ${l} ${o}`, where.map(w => w.value));
      return res.rows;
    },
    async update({ model, where, update }) {
      const table = MODEL_TO_TABLE[model];
      const setFields = Object.keys(update);
      const setClause = setFields.map((k, i) => `"${k}" = $${i + 1}`).join(", ");
      const whereClause = buildWhere(where, setFields.length + 1);
      const res = await q(
        `UPDATE "${table}" SET ${setClause} WHERE ${whereClause} RETURNING *`,
        [...Object.values(update), ...where.map(w => w.value)]
      );
      return res.rows[0] || null;
    },
    async delete({ model, where }) {
      const table = MODEL_TO_TABLE[model];
      await q(`DELETE FROM "${table}" WHERE ${buildWhere(where, 1)}`, where.map(w => w.value));
    },
    async count({ model, where = [] }) {
      const table = MODEL_TO_TABLE[model];
      const w = where.length ? `WHERE ${buildWhere(where, 1)}` : "";
      const res = await q(`SELECT COUNT(*)::int as count FROM "${table}" ${w}`, where.map(w => w.value));
      return res.rows[0]?.count ?? 0;
    }
  };
}

export function getAuth(env) {
  const key = env.DATABASE_URL;
  if (AUTH_CACHE.has(key)) return AUTH_CACHE.get(key);

  const auth = betterAuth({
    database: createNeonAdapter(env),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL || "https://nakubonye.bernestart.workers.dev",
    basePath: "/api/auth",
    trustedOrigins: [
      "http://localhost:5173",
      "capacitor://localhost",
      "http://localhost",
      "https://nakubonye.com"
    ],
    emailAndPassword: { enabled: true },
    plugins: [
      bearer(),
      emailOTP({
        async sendVerificationOTP({ email, otp, type }) {
          if (!env.RESEND_API_KEY) { console.error("RESEND_API_KEY not set"); return; }
          const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Authorization": `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Nakubonye <noreply@nakubonye.com>",
              to: email,
              subject: `Your Nakubonye ${type} code: ${otp}`,
              text: `Your verification code is: ${otp}\n\nThis code expires in 5 minutes.\n\n— Nakubonye`
            })
          });
          if (!r.ok) console.error("Resend error:", await r.text());
        }
      })
    ]
  });

  AUTH_CACHE.set(key, auth);
  return auth;
}
