const fs = require('fs');
const path = 'src/screens/Welcome.jsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Replace the dating tagline
code = code.replace(
  /Somebody is\s*<br \/>\s*looking for you\./,
  `Connect with your world.\n          <br />\n          Share moments. Build communities.`
);

// 2. Remove the three hearts container
code = code.replace(
  /\{\/\* Three hearts \*\/\}[\s\S]*?<\/div>/,
  `{/* Global Connections */}
        <div className="flex items-center justify-center gap-4 mb-12 opacity-80">
          <span className="text-[28px] leading-none">🌍</span>
          <span className="text-[38px] leading-none" style={{ filter: 'drop-shadow(0 8px 24px rgba(168,85,247,0.45))' }}>
            🤝
          </span>
          <span className="text-[28px] leading-none">✨</span>
        </div>`
);

fs.writeFileSync(path, code);
console.log('✅ Welcome.jsx: Rebranded for social network');
