const fs = require('fs');
const file = 'src/components/CommunityChat.jsx';
let code = fs.readFileSync(file, 'utf8');

// The exact zombie block left over from the old function
const zombieBlock = `        setError(err.message)
        setText(bodyToSend)
      } else {
        load()
      }
      setSending(false)
    }
`;

if (code.includes(zombieBlock)) {
  code = code.replace(zombieBlock, '');
  fs.writeFileSync(file, code);
  console.log("✅ SUCCESS: Removed the zombie Supabase code block!");
} else {
  // Fallback if spacing is slightly different
  const fallbackRegex = /setError\(err\.message\)\s*setText\(bodyToSend\)\s*\}\s*else\s*\{\s*load\(\)\s*\}\s*setSending\(false\)\s*\}/;
  if (fallbackRegex.test(code)) {
    code = code.replace(fallbackRegex, '');
    fs.writeFileSync(file, code);
    console.log("✅ SUCCESS: Removed the zombie code (fallback)!");
  } else {
    console.log("⚠️ Could not find the exact zombie block. Let's check the lines.");
  }
}
