const fs = require('fs');
const file = 'src/components/PostComposer.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add import if missing
if (!content.includes('getCurrentLocation')) {
  content = content.replace(
    'import { supabase } from "../lib/supabase"',
    'import { supabase } from "../lib/supabase"\nimport { getCurrentLocation } from "../lib/geolocation"'
  );
}

// 2. Grab location right before the insert
const search1 = 'const scheduledFor = publishAt && new Date(publishAt).getTime() > Date.now() + 60_000';
const replace1 = `const location = await getCurrentLocation()\n        const scheduledFor = publishAt && new Date(publishAt).getTime() > Date.now() + 60_000`;

if (!content.includes('const location = await getCurrentLocation()')) {
  content = content.replace(search1, replace1);
}

// 3. Add location to the payload
const search2 = 'location_text: locationText.trim() || null,';
const replace2 = `location_text: locationText.trim() || null,\n        location: location ? \`SRID=4326;POINT(\${location.lng} \${location.lat})\` : null,`;

if (!content.includes('location: location ?')) {
  content = content.replace(search2, replace2);
}

fs.writeFileSync(file, content);
console.log('✅ Patched PostComposer.jsx with GPS logic');
