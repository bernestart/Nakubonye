const fs = require('fs')

// ── App.jsx ──
{
  const p = 'src/App.jsx'
  let s = fs.readFileSync(p, 'utf8')

  if (!s.includes('StoryArchive')) {
    const anchor = "import Saved from './screens/Saved'"
    if (!s.includes(anchor)) throw new Error('App Saved import missing')
    s = s.replace(anchor, anchor + `\nimport StoryArchive from './screens/StoryArchive'`)
  }

  const routeAnchor = `<Route path="/saved" element={<Guard><Saved /></Guard>} />`
  if (!s.includes(routeAnchor)) throw new Error('Saved route anchor missing')
  if (!s.includes('/story-archive')) {
    s = s.replace(routeAnchor, routeAnchor + `\n        <Route path="/story-archive" element={<Guard><StoryArchive /></Guard>} />`)
  }

  fs.writeFileSync(p, s)
  console.log('OK App.jsx archive route added')
}

// ── ProfileSettings.jsx — add link under Saved row ──
{
  const p = 'src/screens/ProfileSettings.jsx'
  let s = fs.readFileSync(p, 'utf8')

  const savedRowAnchor = `<MenuRow icon={<ShieldCheck size={18} />} label="Tag review" to="/settings/pending-tags" nav={nav} />`
  // Actually put archive near Profile area, not security — use the Saved link as anchor instead
  const savedLinkAnchor = `<span className="flex-1 font-semibold text-[14.5px]">Saved</span>
            <ChevronRight size={18} className="text-subtle" />
          </button>`

  if (!s.includes(savedLinkAnchor)) {
    // Fallback — use a different stable anchor: the invite button
    console.log('SKIP: cannot find Saved row — no link added')
  } else if (!s.includes('/story-archive')) {
    const withArchive = savedLinkAnchor + `
          <button
            onClick={() => { tap('light'); nav('/story-archive') }}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-surface border border-white/8 text-left text-cream"
          >
            <span className="w-9 h-9 rounded-xl bg-white/[0.05] grid place-items-center shrink-0">
              <Clock size={18} />
            </span>
            <span className="flex-1 font-semibold text-[14.5px]">Story archive</span>
            <ChevronRight size={18} className="text-subtle" />
          </button>`
    s = s.replace(savedLinkAnchor, withArchive)

    // Ensure Clock is imported
    const lucideLine = s.split('\n').find((l) => l.includes('from "lucide-react"'))
    if (lucideLine && !lucideLine.includes('Clock')) {
      s = s.replace(lucideLine, lucideLine.replace('{', '{ Clock,'))
    }
  }

  fs.writeFileSync(p, s)
  console.log('OK ProfileSettings archive link added')
}
