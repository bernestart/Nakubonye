const fs = require('fs');
const PC = 'src/components/PostComposer.jsx';
let s = fs.readFileSync(PC, 'utf8');
let n = 0;
function apply(find, replace, label) {
  if (!s.includes(find)) { console.error('❌', label); console.error(JSON.stringify(find.slice(0,150))); process.exit(1); }
  s = s.replace(find, replace); console.log('✅', label); n++;
}

// Add fields inside the insert object (8-space indent)
apply(
`        reshared_include_original: reshareRef ? true : null,
      }).select("id").single()`,
`        reshared_include_original: reshareRef ? true : null,
        location_text: locationText.trim() || null,
        feeling_text: feelingText.trim() || null,
        publish_at: scheduledFor,
      }).select("id").single()`,
'insert: new fields');

// Schedule toast
apply(
`      if (insErr) throw new Error(insErr.message)`,
`      if (insErr) throw new Error(insErr.message)
      if (scheduledFor && new Date(scheduledFor).getTime() > Date.now() + 60_000) {
        try { alert("Scheduled for " + new Date(scheduledFor).toLocaleString()) } catch {}
      }`,
'schedule toast');

fs.writeFileSync(PC, s);
console.log(`\n✅ POST COMPOSER — ${n} edits`);
