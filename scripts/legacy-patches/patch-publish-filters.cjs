const fs = require('fs');
let n = 0;
function editFile(path, find, replace, label) {
  let s = fs.readFileSync(path, 'utf8');
  if (!s.includes(find)) { console.error('❌', label); process.exit(1); }
  s = s.replace(find, replace);
  fs.writeFileSync(path, s);
  console.log('✅', label);
  n++;
}

editFile('src/screens/Feed.jsx',
`      .from("user_posts")
      .select("id, user_id, content, image_path, image_paths, audience, created_at")
      .in("user_id", allowedUserIds)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(20)`,
`      .from("user_posts")
      .select("id, user_id, content, image_path, image_paths, audience, created_at")
      .in("user_id", allowedUserIds)
      .eq("is_active", true)
      .lte("publish_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(20)`,
'feed personal rows');

editFile('src/screens/Feed.jsx',
`      .from("user_posts")
      .select("id, user_id, content, image_path, image_paths, audience, created_at")
      .in("user_id", allowedUserIds)
      .eq("is_active", true)
      .lt("created_at", cursor)
      .order("created_at", { ascending: false })
      .limit(20)`,
`      .from("user_posts")
      .select("id, user_id, content, image_path, image_paths, audience, created_at")
      .in("user_id", allowedUserIds)
      .eq("is_active", true)
      .lt("created_at", cursor)
      .lte("publish_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(20)`,
'feed infinite scroll');

editFile('src/screens/PostDetail.jsx',
`            .from("user_posts")
            .select("id, user_id, content, image_path, image_paths, audience, created_at")
            .eq("id", id).maybeSingle()`,
`            .from("user_posts")
            .select("id, user_id, content, image_path, image_paths, audience, created_at")
            .lte("publish_at", new Date().toISOString())
            .eq("id", id).maybeSingle()`,
'post detail');

editFile('src/screens/ProfileView.jsx',
`      supabase.from('user_posts').select('id, content, image_path, created_at, audience, user_id')
        .eq('user_id', userId).eq('is_active', true).order('created_at', { ascending: false }).limit(60),`,
`      supabase.from('user_posts').select('id, content, image_path, created_at, audience, user_id')
        .eq('user_id', userId).eq('is_active', true).lte('publish_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(60),`,
'profile view');

editFile('src/screens/Preview.jsx',
`      supabase.from('user_posts').select('id, content, image_path, created_at')
        .eq('user_id', myId).eq('is_active', true).order('created_at', { ascending: false }).limit(30),`,
`      supabase.from('user_posts').select('id, content, image_path, created_at')
        .eq('user_id', myId).eq('is_active', true).lte('publish_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(30),`,
'preview');

editFile('src/screens/Saved.jsx',
`        const { data } = await supabase.from("user_posts")
          .select("id, user_id, content, image_path, created_at")
          .in("id", personalIds)`,
`        const { data } = await supabase.from("user_posts")
          .select("id, user_id, content, image_path, created_at")
          .in("id", personalIds)
          .lte("publish_at", new Date().toISOString())`,
'saved');

editFile('src/screens/Memories.jsx',
`      supabase.from("user_posts")
        .select("id, user_id, content, image_path, image_paths, created_at")
        .eq("user_id", myId)
        .lt("created_at", new Date(thisYear, 0, 1).toISOString())
        .limit(300),`,
`      supabase.from("user_posts")
        .select("id, user_id, content, image_path, image_paths, created_at")
        .eq("user_id", myId)
        .lt("created_at", new Date(thisYear, 0, 1).toISOString())
        .lte("publish_at", new Date().toISOString())
        .limit(300),`,
'memories');

editFile('src/screens/Search.jsx',
`        ? supabase.from("user_posts").select("id, user_id, content, image_path, created_at").in("id", postPersonalIds)`,
`        ? supabase.from("user_posts").select("id, user_id, content, image_path, created_at").in("id", postPersonalIds).lte("publish_at", new Date().toISOString())`,
'search by id');

editFile('src/screens/Search.jsx',
`        supabase.from('user_posts').select('content').gt('created_at', since).limit(200),`,
`        supabase.from('user_posts').select('content').gt('created_at', since).lte('publish_at', new Date().toISOString()).limit(200),`,
'search hashtag content');

console.log(`\n✅ ${n} read-query filters applied`);
