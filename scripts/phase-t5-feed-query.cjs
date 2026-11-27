const fs = require('fs');
const p = 'src/screens/Feed.jsx';

if (!fs.existsSync(p)) process.exit(1);
let s = fs.readFileSync(p, 'utf8');
let changes = 0;

// 1. Add TanStack Query import
if (!s.includes('useQueryClient')) {
  s = s.replace(
    "import { Fragment, useCallback, useEffect, useRef, useState } from \"react\"",
    "import { Fragment, useCallback, useEffect, useRef, useState } from \"react\"\nimport { useQueryClient } from '@tanstack/react-query';"
  );
  changes++;
}

// 2. Initialize queryClient inside the component
const compStart = s.indexOf("export default function Feed(");
if (compStart > -1) {
  const hookPos = s.indexOf("const [posts, setPosts] = useState([]);", compStart);
  if (hookPos > -1) {
    s = s.slice(0, hookPos) + "const queryClient = useQueryClient();\n  " + s.slice(hookPos);
    changes++;
  }
}

// 3. Replace the raw fetch with queryClient.fetchQuery for caching
const fetchTarget = `const res = await fetch(\`\${API_BASE_URL}/api/feed/v2\`).then(r => r.json()).catch(() => ({ success: false }))`;
const fetchReplacement = `const res = await queryClient.fetchQuery({
        queryKey: ['feed', myId],
        queryFn: () => fetch(\`\${API_BASE_URL}/api/feed/v2\`).then(r => r.json()).catch(() => ({ success: false })),
        staleTime: 1000 * 60 * 5 // Cache for 5 minutes
      })`;

if (s.includes(fetchTarget)) {
  s = s.replace(fetchTarget, fetchReplacement);
  changes++;
} else {
  // Fallback match if the spacing was different
  const looseFetch = s.indexOf("const res = await fetch(`${API_BASE_URL}/api/feed/v2`)");
  if (looseFetch > -1) {
    const endLine = s.indexOf('\n', looseFetch);
    const oldLine = s.slice(looseFetch, endLine);
    s = s.replace(oldLine, fetchReplacement);
    changes++;
  }
}

// 4. Add queryClient to the useCallback dependency array
s = s.replace(`}, [myId])`, `}, [myId, queryClient])`);

fs.writeFileSync(p, s, 'utf8');
console.log(`✅ Applied ${changes} TanStack Query changes to Feed.jsx.`);
