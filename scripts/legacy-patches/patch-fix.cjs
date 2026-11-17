const fs = require('fs');

// ---------- 1. ProfileSettings.jsx — move Creator mode row to top-level ----------
{
  const p = 'src/screens/ProfileSettings.jsx';
  let s = fs.readFileSync(p, 'utf8');

  // Remove the row I added inside Settings & privacy
  const removeMe = `          <MenuRow icon={<Sparkles size={18} />} label="Creator mode" to="/settings/creator" nav={nav} />\n`;
  if (!s.includes(removeMe)) { console.error('❌ row to remove not found'); process.exit(1); }
  s = s.replace(removeMe, '');
  console.log('✅ removed row from Settings collapsible');

  // Insert as top-level row before "Add to your story"
  const anchor = `        {/* Standalone rows above grid M-bM-^@M-^T Facebook pattern */}`;
  // The file has UTF-8 em-dash, so match a simpler substring:
  const anchorSimple = `        {/* Standalone rows above grid`;
  const idx = s.indexOf(anchorSimple);
  if (idx === -1) { console.error('❌ standalone rows anchor not found'); process.exit(1); }

  // Find the opening <div> right after the anchor
  const after = s.slice(idx);
  const divIdx = after.indexOf('        <div className="flex flex-col gap-1.5 mb-4">');
  if (divIdx === -1) { console.error('❌ standalone rows div not found'); process.exit(1); }

  const insertPos = idx + divIdx + `        <div className="flex flex-col gap-1.5 mb-4">`.length;
  const creatorRow = `
          <button
            onClick={() => { tap('light'); nav('/settings/creator') }}
            className="w-full flex items-center gap-4 px-4 py-3.5 text-left border-b border-white/6 active:bg-white/[0.03]"
          >
            <span className="shrink-0 text-purple-300">
              <Sparkles size={18} />
            </span>
            <span className="flex-1 text-cream text-[15px] font-medium">Creator mode</span>
            <ChevronRight size={18} className="text-muted shrink-0" />
          </button>`;
  s = s.slice(0, insertPos) + creatorRow + s.slice(insertPos);
  console.log('✅ added Creator mode as top-level row');

  fs.writeFileSync(p, s);
}

// ---------- 2. CreatorMode.jsx — palette fix ----------
{
  const p = 'src/screens/CreatorMode.jsx';
  let s = fs.readFileSync(p, 'utf8');

  const from = `'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)'`;
  const to   = `'linear-gradient(135deg, #4C1D95 0%, #7C3AED 100%)'`;
  let n = 0;
  while (s.includes(from)) { s = s.replace(from, to); n++; }
  if (n === 0) { console.error('❌ gradient not found'); process.exit(1); }
  console.log('✅ replaced gradient —', n, 'occurrence(s)');

  fs.writeFileSync(p, s);
}

console.log('✅ all patches applied');
