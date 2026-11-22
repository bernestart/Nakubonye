const fs=require('fs');
const fails=[],notes=[];
let w=fs.readFileSync('backend/_worker.js','utf8');
let m=fs.readFileSync('src/screens/Messages.jsx','utf8');
const ROUTE=String.raw`      if (path === "/api/inbox" && request.method === "GET") {
        const jh = { ...cors, "Content-Type": "application/json" };
        const out = (status, obj) => new Response(JSON.stringify(obj), { status, headers: jh });
        const me = await getSessionUser(request, env, url);
        if (!me) return out(401, { success: false, error: "UNAUTHENTICATED" });
        const uid = String(me.id).toLowerCase();
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uid)) return out(409, { success: false, error: "LEGACY_ACCOUNT_ID" });
        try {
          const R = async (sql, params) => (await queryDatabase(sql, params)).rows;
          const ts = (v) => { if (!v) return null; const s = String(v); const d = new Date(s.includes("T") ? s : s.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00")); return isNaN(d) ? null : d.toISOString(); };
          const isFalse = (v) => v === false || v === "f" || v === "false";
          const U = [uid];
          const [matches, directs, mem, cPins, gPins, cArch, gArch, cDel, gDel, reqRows, myFollows, blockRows, reads, mutes, gReads] = await Promise.all([
            R("SELECT id, user_one_id, user_two_id, created_at FROM matches WHERE user_one_id = $1::uuid OR user_two_id = $1::uuid", U),
            R("SELECT id, initiator_id, recipient_id, created_at, last_message_at, last_message_preview FROM conversations WHERE is_direct = true AND (initiator_id = $1::uuid OR recipient_id = $1::uuid)", U),
            R("SELECT group_id FROM group_members WHERE user_id = $1::uuid", U),
            R("SELECT conversation_id FROM conversation_pins WHERE user_id = $1::uuid", U),
            R("SELECT group_id FROM group_pins WHERE user_id = $1::uuid", U),
            R("SELECT conversation_id FROM conversation_archives WHERE user_id = $1::uuid", U),
            R("SELECT group_id FROM group_archives WHERE user_id = $1::uuid", U),
            R("SELECT conversation_id FROM conversation_deletes WHERE user_id = $1::uuid", U),
            R("SELECT group_id FROM group_deletes WHERE user_id = $1::uuid", U),
            R("SELECT COUNT(*)::int AS n FROM message_requests WHERE recipient_id = $1::uuid AND status = 'pending'", U),
            R("SELECT following_id FROM follows WHERE follower_id = $1::uuid", U),
            R("SELECT blocker_id, blocked_id FROM blocks WHERE blocker_id = $1::uuid OR blocked_id = $1::uuid", U),
            R("SELECT conversation_id, last_read_at FROM conversation_reads WHERE user_id = $1::uuid", U),
            R("SELECT conversation_id FROM conversation_mutes WHERE user_id = $1::uuid", U),
            R("SELECT group_id, last_read_at FROM group_reads WHERE user_id = $1::uuid", U),
          ]);
          const matchIds = matches.map((x) => String(x.id));
          const gids = mem.map((x) => String(x.group_id));
          const otherByMatch = new Map(matches.map((x) => [String(x.id), String(x.user_one_id) === uid ? String(x.user_two_id) : String(x.user_one_id)]));
          const directOthers = directs.map((c) => String(c.initiator_id) === uid ? c.recipient_id : c.initiator_id).filter(Boolean).map(String);
          const otherIds = [...new Set([...otherByMatch.values(), ...directOthers])];
          const [convs, groups, lastMsgs, profs, photos, stories, onlineRows] = await Promise.all([
            R("SELECT id, match_id, created_at, last_message_at, last_message_preview FROM conversations WHERE match_id = ANY($1::bigint[])", [matchIds]),
            R("SELECT id, name, avatar_url, updated_at FROM groups WHERE id = ANY($1::uuid[])", [gids]),
            R("SELECT DISTINCT ON (group_id) group_id, content, media_type, created_at, deleted_at FROM group_messages WHERE group_id = ANY($1::uuid[]) ORDER BY group_id, created_at DESC", [gids]),
            R("SELECT id, display_name, username, is_verified, last_seen_at FROM profiles WHERE id = ANY($1::uuid[])", [otherIds]),
            R("SELECT user_id, storage_path FROM profile_photos WHERE user_id = ANY($1::uuid[]) ORDER BY is_primary DESC, display_order ASC", [otherIds]),
            R("SELECT id::text AS id, user_id FROM stories WHERE user_id = ANY($1::uuid[]) AND expires_at > NOW()", [otherIds]),
            R("SELECT id, display_name, username, last_seen_at FROM profiles WHERE last_seen_at > NOW() - INTERVAL '3 minutes' AND id <> $1::uuid AND is_active = true ORDER BY last_seen_at DESC LIMIT 30", U),
          ]);
          const onlineIds = onlineRows.map((r) => String(r.id));
          const storyIds = stories.map((s) => String(s.id));
          const [settings, onPhotos, views] = await Promise.all([
            R("SELECT user_id, who_can_see_online, show_activity_status FROM user_settings WHERE user_id = ANY($1::uuid[])", [onlineIds]),
            R("SELECT user_id, storage_path FROM profile_photos WHERE user_id = ANY($1::uuid[]) ORDER BY is_primary DESC, display_order ASC", [onlineIds]),
            R("SELECT story_id::text AS story_id FROM story_views WHERE user_id = $1::uuid AND story_id::text = ANY($2::text[])", [uid, storyIds]),
          ]);
          const firstPhoto = (arr) => { const mp = new Map(); for (const r of arr) { const k = String(r.user_id); if (!mp.has(k)) mp.set(k, r.storage_path); } return mp; };
          const photoMap = firstPhoto(photos), onPhoto = firstPhoto(onPhotos);
          const profMap = new Map(profs.map((p) => [String(p.id), p]));
          const readsMap = new Map(reads.map((r) => [String(r.conversation_id), r.last_read_at]));
          const convByMatch = new Map(convs.map((c) => [String(c.match_id), c]));
          const isNewer = (a, b) => !!a && (!b || new Date(ts(a)) > new Date(ts(b)));
          const items = [];
          for (const mt of matches) {
            const otherId = otherByMatch.get(String(mt.id));
            const p = profMap.get(otherId);
            if (!p) continue;
            const conv = convByMatch.get(String(mt.id));
            items.push({ matchId: mt.id, conversationId: conv ? conv.id : null, userId: otherId, display_name: p.display_name, username: p.username, is_verified: p.is_verified, photo_path: photoMap.get(otherId) || null, last_seen_at: ts(p.last_seen_at), preview: conv ? conv.last_message_preview : null, lastMessageAt: ts(conv && conv.last_message_at) || ts(mt.created_at), unread: !!(conv && isNewer(conv.last_message_at, readsMap.get(String(conv.id)))), isNewMatch: !(conv && conv.last_message_at) });
          }
          for (const c of directs) {
            const other = String(c.initiator_id) === uid ? c.recipient_id : c.initiator_id;
            if (!other) continue;
            const oid = String(other);
            if (items.some((x) => x.userId === oid)) continue;
            const p = profMap.get(oid);
            if (!p) continue;
            items.push({ matchId: null, conversationId: c.id, userId: oid, display_name: p.display_name, username: p.username, is_verified: p.is_verified, photo_path: photoMap.get(oid) || null, last_seen_at: ts(p.last_seen_at), preview: c.last_message_preview || null, lastMessageAt: ts(c.last_message_at) || ts(c.created_at), unread: !!(c.last_message_at && isNewer(c.last_message_at, readsMap.get(String(c.id)))), isDirect: true });
          }
          const mutedSet = new Set(mutes.map((r) => String(r.conversation_id)));
          items.forEach((x) => { x.muted = x.conversationId ? mutedSet.has(String(x.conversationId)) : false; });
          items.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
          const lastByGroup = new Map(lastMsgs.map((x) => [String(x.group_id), x]));
          const gReadMap = new Map(gReads.map((r) => [String(r.group_id), r.last_read_at]));
          const groupItems = groups.map((g) => {
            const last = lastByGroup.get(String(g.id));
            let preview = null;
            if (last && !last.deleted_at) preview = last.media_type && String(last.media_type).startsWith("image/") ? "📷 Photo" : (last.content || null);
            const at = ts(last ? last.created_at : g.updated_at);
            return { isGroup: true, groupId: g.id, conversationId: null, display_name: g.name, photo_url: g.avatar_url || null, preview, lastMessageAt: at, unread: !!(at && isNewer(at, gReadMap.get(String(g.id)))) };
          });
          const blockSet = new Set();
          for (const b of blockRows) { if (String(b.blocker_id) === uid) blockSet.add(String(b.blocked_id)); if (String(b.blocked_id) === uid) blockSet.add(String(b.blocker_id)); }
          const matchSet = new Set(matches.map((x) => String(x.user_one_id) === uid ? String(x.user_two_id) : String(x.user_one_id)));
          const followSet = new Set(myFollows.map((f) => String(f.following_id)));
          const sMap = new Map(settings.map((r) => [String(r.user_id), r]));
          const online = onlineRows.filter((u) => {
            const id = String(u.id);
            if (blockSet.has(id)) return false;
            const row = sMap.get(id);
            if (!row) return true;
            if (isFalse(row.show_activity_status)) return false;
            const v = row.who_can_see_online || "everyone";
            if (v === "nobody") return false;
            if (v === "matches") return matchSet.has(id);
            if (v === "following") return followSet.has(id);
            return true;
          }).map((u) => ({ id: String(u.id), display_name: u.display_name, username: u.username, last_seen_at: ts(u.last_seen_at), photo_path: onPhoto.get(String(u.id)) || null }));
          const dmUsers = new Set(items.map((x) => x.userId));
          const byOwner = new Map();
          for (const s of stories) { const o = String(s.user_id); if (!dmUsers.has(o)) continue; if (!byOwner.has(o)) byOwner.set(o, []); byOwner.get(o).push(String(s.id)); }
          const viewedIds = new Set(views.map((v) => String(v.story_id)));
          const storyOwners = [...byOwner.keys()];
          const viewedStoryOwners = storyOwners.filter((o) => byOwner.get(o).every((id) => viewedIds.has(id)));
          return out(200, { success: true, data: {
            items, groupItems,
            pinned: [...cPins.map((r) => "c:" + r.conversation_id), ...gPins.map((r) => "g:" + r.group_id)],
            archived: [...cArch.map((r) => "c:" + r.conversation_id), ...gArch.map((r) => "g:" + r.group_id)],
            deleted: [...cDel.map((r) => "c:" + r.conversation_id), ...gDel.map((r) => "g:" + r.group_id)],
            online, storyOwners, viewedStoryOwners,
            pendingRequests: (reqRows[0] && reqRows[0].n) || 0,
          } });
        } catch (err) {
          console.error("[inbox] " + String((err && err.message) || "").slice(0, 200));
          return out(500, { success: false, error: "INBOX_FAILED" });
        }
      }
`;
const LOAD=String.raw`const load = useCallback(async () => {
    if (!session?.user?.id) { setLoading(false); return }
    setLoading(true); setError('')
    try {
      const token = localStorage.getItem('auth_token')
      const res = await fetch(API_BASE_URL + '/api/inbox', { headers: { Authorization: 'Bearer ' + token } })
      const json = await res.json()
      if (!json || !json.success) throw new Error((json && json.error) || 'Could not load messages')
      const d = json.data
      setItems((d.items || []).map((x) => ({ ...x, photo_url: publicPhotoUrl(x.photo_path) })))
      setGroupItems(d.groupItems || [])
      setPinnedKeys(new Set(d.pinned || []))
      setArchivedKeys(new Set(d.archived || []))
      setDeletedKeys(new Set(d.deleted || []))
      setOnlineUsers((d.online || []).map((u) => ({ ...u, photo_url: u.photo_path ? publicPhotoUrl(u.photo_path) : null })))
      setStoryOwners(new Set(d.storyOwners || []))
      setViewedStoryOwners(new Set(d.viewedStoryOwners || []))
      setPendingRequests(d.pendingRequests || 0)
      setLoading(false)
    } catch (e) {
      console.error('Messages load error:', e)
      setError(friendlyError(e))
      setLoading(false)
    }
  }, [session?.user?.id])`;
// Worker: /api/inbox
if(w.includes('path === "/api/inbox" &&'))notes.push('Worker: /api/inbox already present');
else if(w.split('// WEBSOCKET ROUTE (Real-Time Chat)').length!==2)fails.push('Worker anchor WEBSOCKET ROUTE (need exactly 1)');
else{w=w.replace(/\n( {6})\/\/ WEBSOCKET ROUTE \(Real-Time Chat\)/,x=>'\n'+ROUTE+x);notes.push('Worker: /api/inbox added');}
// Worker: permissions identity
const pl='if (path === "/api/chat/permissions" && !authUser) return deny(401, "UNAUTHENTICATED");';
if(w.includes('get("sender") || "").toLowerCase()'))notes.push('Worker: permissions identity already set');
else if(w.split(pl).length!==2)fails.push('Worker anchor chat/permissions line (need exactly 1)');
else{w=w.replace(pl,()=>pl+'\n      if (path === "/api/chat/permissions" && String(url.searchParams.get("sender") || "").toLowerCase() !== String(authUser.id).toLowerCase()) return deny(403, "IDENTITY_MISMATCH");');notes.push('Worker: permissions now requires sender = session user');}
// Messages.jsx: load
const starts=[...m.matchAll(/const load = useCallback\(async \(\) => \{/g)];
if(starts.length!==1)fails.push('Messages.jsx: load start anchor (found '+starts.length+')');
else{
  const si=starts[0].index, endMark='}, [session?.user?.id])', ei=m.indexOf(endMark,si);
  const seg=ei>-1?m.slice(si,ei):'';
  if(ei<0||!seg.includes('Messages load error')||seg.length>40000)fails.push('Messages.jsx: load end anchor/segment check failed');
  else{
    for(const st of ['setItems','setGroupItems','setPinnedKeys','setArchivedKeys','setDeletedKeys','setOnlineUsers','setStoryOwners','setViewedStoryOwners','setPendingRequests','setLoading','setError'])
      if(!new RegExp('const \\[[^\\]]*\\b'+st+'\\b').test(m))fails.push('Messages.jsx: state setter missing: '+st);
    if(!fails.length){
      m=m.slice(0,si)+LOAD+m.slice(ei+endMark.length);
      if(!/import[^;\n]*\bAPI_BASE_URL\b[^;\n]*from/.test(m)){
        const imp="import { supabase } from '../lib/supabase'";
        if(m.includes(imp))m=m.replace(imp,()=>"import { API_BASE_URL } from '../lib/api'\n"+imp);
        else fails.push('Messages.jsx: cannot place API_BASE_URL import');
      }
      notes.push('Messages.jsx: load replaced with one request to /api/inbox');
    }
  }
}
if(fails.length){console.log('ABORTED, nothing written:\n'+fails.join('\n'));process.exit(1);}
fs.writeFileSync('backend/_worker.js',w);fs.writeFileSync('src/screens/Messages.jsx',m);
fs.appendFileSync('ROADMAP.md','\n## S2 (2026-11-22)\nGET /api/inbox (session identity, one response for the Messages list); Messages.jsx load now one request; chat/permissions requires sender = session user. Messages.jsx still on Supabase: markAllRead, pin/archive/mute/delete actions, block, stories row, realtime channel (dead: messages live in Neon). Chat.jsx still has ~25 supabase calls. Guard: run node scripts/check-undef.cjs after every patch.\n');
console.log('APPLIED:\n- '+notes.join('\n- '));
