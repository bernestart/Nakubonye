const fs = require('fs');
const file = 'src/screens/Chat.jsx';
let code = fs.readFileSync(file, 'utf8');

// The exact broken block from your output
const brokenBlock = `            <div className="w-10 h-10 rounded-full overflow-hidden bg-elevated border border-white/8">
              {other?.photo_url ? (
                <img src={other.photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full grid place-items-center text-base font-black text-purple-400">
                  {(other?.display_name || '?')[0]}
                </div>
              <OnlineDot userId={otherId} myId={myId} variant="avatar" />
              )}
            </div>`;

// The fixed block: Added 'relative' to parent, moved OnlineDot out of ternary, closed ternary correctly
const fixedBlock = `            <div className="relative w-10 h-10 rounded-full bg-elevated border border-white/8">
              <div className="w-full h-full rounded-full overflow-hidden">
                {other?.photo_url ? (
                  <img src={other.photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full grid place-items-center text-base font-black text-purple-400">
                    {(other?.display_name || '?')[0]}
                  </div>
                )}
              </div>
              <OnlineDot userId={otherId} myId={myId} variant="avatar" className="!w-3 !h-3 !bottom-0 !right-0" />
            </div>`;

if (code.includes(brokenBlock)) {
  code = code.replace(brokenBlock, fixedBlock);
  fs.writeFileSync(file, code);
  console.log("✅ SUCCESS: Fixed JSX syntax and placed OnlineDot perfectly in Chat.jsx!");
} else {
  console.log("⚠️ Could not find the exact broken block. Let's try a looser match.");
  
  // Fallback if whitespace is slightly different
  const regex = /<div className="w-10 h-10 rounded-full overflow-hidden[\s\S]*?<OnlineDot[^>]*\/>\s*\)\s*<\/div>/;
  if (regex.test(code)) {
     code = code.replace(regex, fixedBlock);
     fs.writeFileSync(file, code);
     console.log("✅ SUCCESS: Fixed JSX syntax (Regex fallback)!");
  }
}
