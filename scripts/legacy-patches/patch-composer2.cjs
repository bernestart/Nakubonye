const fs = require('fs');
const PC = 'src/components/PostComposer.jsx';
let s = fs.readFileSync(PC, 'utf8');
let n = 0;
function apply(find, replace, label) {
  if (!s.includes(find)) { console.error('❌', label); process.exit(1); }
  s = s.replace(find, replace); console.log('✅', label); n++;
}

// 1. insert scheduledFor before the insert call
apply(
`const { data: insertedRow, error: insErr } = await supabase.from("user_posts").insert({`,
`const scheduledFor = publishAt && new Date(publishAt).getTime() > Date.now() + 60_000
          ? new Date(publishAt).toISOString()
          : new Date().toISOString()
        const { data: insertedRow, error: insErr } = await supabase.from("user_posts").insert({`,
'insert: scheduledFor');

// 2. add fields inside the insert object — anchor on a known field line
apply(
`          reshared_include_original: reshareRef ? true : null,
        }).select("id").single()`,
`          reshared_include_original: reshareRef ? true : null,
          location_text: locationText.trim() || null,
          feeling_text: feelingText.trim() || null,
          publish_at: scheduledFor,
        }).select("id").single()`,
'insert: new fields');

// 3. add schedule toast after insert success
apply(
`        if (insErr) throw new Error(insErr.message)`,
`        if (insErr) throw new Error(insErr.message)
        if (scheduledFor && new Date(scheduledFor).getTime() > Date.now() + 60_000) {
          try { alert("Scheduled for " + new Date(scheduledFor).toLocaleString()) } catch {}
        }`,
'schedule toast');

fs.writeFileSync(PC, s);
console.log(`\n✅ POST COMPOSER — ${n} edits`);
