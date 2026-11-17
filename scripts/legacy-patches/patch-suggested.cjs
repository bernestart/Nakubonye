const fs = require("fs");
const p = "src/screens/Feed.jsx";
let s = fs.readFileSync(p, "utf8");

// 1. Add state
const stateAnchor = `  const [commentsFor, setCommentsFor] = useState(null)`;
if (!s.includes(stateAnchor)) { console.error("commentsFor state missing"); process.exit(1); }
if (!s.includes("suggested")) {
  s = s.replace(stateAnchor, stateAnchor + `\n  const [suggested, setSuggested] = useState([])`);
}

// 2. Load suggested users in load()
const loadEndAnchor = `    setReelsRail(reelRows || [])`;
if (!s.includes(loadEndAnchor)) { console.error("setReelsRail anchor missing"); process.exit(1); }
if (!s.includes("get_discover_profiles")) {
  s = s.replace(loadEndAnchor, loadEndAnchor + `

    // Suggested people
    const { data: sug } = await supabase.rpc("get_discover_profiles", {
      p_limit: 10,
      p_same_city: false,
      p_shared_interests: false,
      p_same_country: false,
      p_verified_only: false,
      p_online_only: false,
      p_community_id: null,
    })
    setSuggested((sug || []).slice(0, 10).map((r) => ({
      id: r.id,
      display_name: r.display_name,
      username: r.username,
      photo_url: publicPhotoUrl(r.primary_photo),
    })))`);
}

// 3. Wrap each post in a Fragment + inject the rail after every 4 posts
const postsMapOpen = `          posts.map((p) => {`;
if (!s.includes(postsMapOpen)) { console.error("posts.map missing"); process.exit(1); }
if (!s.includes("posts.map((p, idx) =>")) {
  s = s.replace(postsMapOpen, `          posts.map((p, idx) => {`);
}

const postReturnAnchor = `            return (
              <article key={p.id} className="mb-4 rounded-2xl bg-white/[0.03] border border-white/8 overflow-hidden">`;
if (!s.includes(postReturnAnchor)) { console.error("post return anchor missing"); process.exit(1); }
if (!s.includes("<Fragment key={p.id}>")) {
  s = s.replace(postReturnAnchor, `            return (
              <Fragment key={p.id}>
              <article className="mb-4 rounded-2xl bg-white/[0.03] border border-white/8 overflow-hidden">`);
}

// 4. Close the fragment + add rail after every 4th post
const postCloseAnchor = `              </article>
            )
          })`;
if (!s.includes(postCloseAnchor)) { console.error("post close anchor missing"); process.exit(1); }
if (!s.includes("People you may know")) {
  s = s.replace(postCloseAnchor, `              </article>

              {(idx + 1) % 4 === 0 && suggested.length > 0 && (
                <div className="mb-4 rounded-2xl bg-white/[0.03] border border-white/8 overflow-hidden">
                  <p className="text-purple-400 text-[10.5px] font-black tracking-[0.16em] uppercase px-3 pt-3 mb-2">
                    People you may know
                  </p>
                  <div className="flex gap-3 overflow-x-auto px-3 pb-3" style={{ scrollbarWidth: "none" }}>
                    {suggested.slice(0, 6).map((u) => (
                      <button
                        key={u.id}
                        onClick={() => { tap("light"); nav("/profile/" + u.id) }}
                        className="shrink-0 flex flex-col items-center gap-1.5"
                        style={{ width: 92 }}
                      >
                        <span className="w-[72px] h-[72px] rounded-full overflow-hidden bg-elevated border-2 border-white/10">
                          {u.photo_url ? (
                            <img src={u.photo_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="w-full h-full grid place-items-center text-purple-400 font-black text-xl">
                              {(u.display_name || "?")[0]}
                            </span>
                          )}
                        </span>
                        <span className="text-cream text-[12px] font-semibold truncate w-full text-center">
                          {u.display_name || u.username}
                        </span>
                        <span className="text-purple-300 text-[11px] font-bold">View</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              </Fragment>
            )
          })`);
}

// 5. Import Fragment
const reactImport = `import { useCallback, useEffect, useRef, useState } from "react"`;
if (!s.includes(reactImport)) { console.error("react import missing"); process.exit(1); }
if (!s.includes("Fragment")) {
  s = s.replace(reactImport, `import { Fragment, useCallback, useEffect, useRef, useState } from "react"`);
}

fs.writeFileSync(p, s);
console.log("suggested people rail wired");
