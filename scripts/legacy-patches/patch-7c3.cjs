const fs = require('fs')

// ── 1. GroupChat.jsx ──
{
  const p = 'src/screens/GroupChat.jsx'
  let s = fs.readFileSync(p, 'utf8')

  if (!s.includes('ChatSearchSheet')) {
    const anchor = s.split('\n').find((l) => l.includes("import MessageActionsSheet"))
    if (!anchor) throw new Error('MessageActionsSheet import missing')
    s = s.replace(anchor, anchor + `\nimport ChatSearchSheet from "../components/ChatSearchSheet"`)
  }

  // Add Search to imports
  const lucideLine = s.split('\n').find((l) => l.includes("from \"lucide-react\""))
  if (lucideLine && !lucideLine.includes(' Search,')) {
    s = s.replace(lucideLine, lucideLine.replace('{', '{ Search,'))
  }

  // State
  const stateAnchor = `  const [menuOpen, setMenuOpen] = useState(false)`
  if (!s.includes(stateAnchor)) throw new Error('GroupChat menuOpen state missing')
  if (!s.includes('searchOpen')) {
    s = s.replace(stateAnchor, stateAnchor + `\n  const [searchOpen, setSearchOpen] = useState(false)`)
  }

  // Search button before menu
  const menuBtn = `        <button onClick={() => setMenuOpen(true)} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Menu">
          <MoreVertical size={20} strokeWidth={2.2} />
        </button>`

  if (!s.includes(menuBtn)) throw new Error('GroupChat menu button anchor missing')

  const withSearch = `        <button onClick={() => { tap("light"); setSearchOpen(true) }} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Search in chat">
          <Search size={19} strokeWidth={2.3} />
        </button>

` + menuBtn

  s = s.replace(menuBtn, withSearch)

  // Render search sheet before menu render
  const renderAnchor = `      {menuOpen && (`
  if (!s.includes(renderAnchor)) throw new Error('GroupChat menu render anchor missing')
  if (!s.includes('{searchOpen &&')) {
    s = s.replace(renderAnchor, `      {searchOpen && (
        <ChatSearchSheet
          source="group"
          targetId={groupId}
          onClose={() => setSearchOpen(false)}
        />
      )}

` + renderAnchor)
  }

  fs.writeFileSync(p, s)
  console.log('OK GroupChat search wired')
}

// ── 2. CommunityChat.jsx ──
{
  const p = 'src/components/CommunityChat.jsx'
  let s = fs.readFileSync(p, 'utf8')

  if (!s.includes('ChatSearchSheet')) {
    const anchor = s.split('\n').find((l) => l.includes("import MessageActionsSheet"))
    if (!anchor) throw new Error('CommunityChat MessageActionsSheet import missing')
    s = s.replace(anchor, anchor + `\nimport ChatSearchSheet from "./ChatSearchSheet"`)
  }

  // Add Search icon
  const lucideLine = s.split('\n').find((l) => l.includes("from 'lucide-react'"))
  if (lucideLine && !lucideLine.includes(' Search,') && !lucideLine.includes(' Search }') && !lucideLine.includes('Search,')) {
    s = s.replace(lucideLine, lucideLine.replace('{', '{ Search,'))
  }

  // Find menuOpen state
  const stateAnchor = s.split('\n').find((l) => l.trim().startsWith('const [menuOpen'))
  if (!stateAnchor) throw new Error('CommunityChat menuOpen state missing')
  if (!s.includes('const [searchOpen')) {
    s = s.replace(stateAnchor, stateAnchor + `\n  const [searchOpen, setSearchOpen] = useState(false)`)
  }

  // Find the menu button
  const menuBtnMatch = s.match(/<button onClick=\{\(\) => setMenuOpen\(true\)\}[\s\S]*?<\/button>/)
  if (!menuBtnMatch) throw new Error('CommunityChat menu button not found')

  const existingBtn = menuBtnMatch[0]
  const searchBtn = `        <button onClick={() => { tap("light"); setSearchOpen(true) }} className="w-9 h-9 rounded-full grid place-items-center text-muted" aria-label="Search in chat">
          <Search size={19} strokeWidth={2.3} />
        </button>\n\n`

  if (!s.includes('Search in chat')) {
    s = s.replace(existingBtn, searchBtn + existingBtn)
  }

  // Render search sheet
  const renderAnchor = s.indexOf('{menuOpen && (')
  if (renderAnchor !== -1 && !s.includes('{searchOpen &&')) {
    s = s.slice(0, renderAnchor) + `{searchOpen && (
        <ChatSearchSheet
          source="community"
          targetId={communityId}
          onClose={() => setSearchOpen(false)}
        />
      )}

      ` + s.slice(renderAnchor)
  }

  fs.writeFileSync(p, s)
  console.log('OK CommunityChat search wired')
}
