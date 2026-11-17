const fs = require('fs')

// ============ GroupChat.jsx ============
{
  const p = 'src/screens/GroupChat.jsx'
  let s = fs.readFileSync(p, 'utf8')

  // 1. Import
  const IMP = `import MessageActionsSheet from "../components/MessageActionsSheet"`
  if (!s.includes(IMP)) throw new Error('MessageActionsSheet import missing')
  if (!s.includes('ForwardPicker'))
    s = s.replace(IMP, IMP + `\nimport ForwardPicker from "../components/ForwardPicker"`)

  // 2. State
  const ST = `  const [pinnedMsg, setPinnedMsg] = useState(null)`
  if (!s.includes(ST)) throw new Error('pinnedMsg state anchor missing')
  if (!s.includes('forwardingMsg'))
    s = s.replace(ST, ST + `\n  const [forwardingMsg, setForwardingMsg] = useState(null)`)

  // 3. onForward handler
  const FWD = `          onForward={(m) => { setActionsForMsg(null); alert("Forward coming soon") }}`
  if (!s.includes(FWD)) throw new Error('onForward anchor missing')
  s = s.replace(FWD, `          onForward={(m) => { setActionsForMsg(null); setForwardingMsg(m) }}`)

  // 4. Render ForwardPicker before final closing
  const END = `      )}
    </div>
  )
}

function MenuItem(`
  // fallback safe anchor
  const si = s.lastIndexOf(END)
  if (si < 0) throw new Error('GroupChat end anchor missing')

  const PICKER = `      )}

      {forwardingMsg && (
        <ForwardPicker
          message={forwardingMsg}
          onClose={() => setForwardingMsg(null)}
          onForwarded={() => {}}
        />
      )}
    </div>
  )
}

function MenuItem(`

  s = s.slice(0, si) + PICKER + s.slice(si + END.length)
  fs.writeFileSync(p, s)
  console.log('OK GroupChat forward')
}

// ============ CommunityChat.jsx ============
{
  const p = 'src/components/CommunityChat.jsx'
  let s = fs.readFileSync(p, 'utf8')

  // 1. Import
  const IMP = `import MessageActionsSheet from './MessageActionsSheet'`
  if (!s.includes(IMP)) throw new Error('MessageActionsSheet import missing')
  if (!s.includes('ForwardPicker'))
    s = s.replace(IMP, IMP + `\nimport ForwardPicker from './ForwardPicker'`)

  // 2. State
  const ST = `  const [pinnedMsg, setPinnedMsg] = useState(null)`
  if (!s.includes(ST)) throw new Error('pinnedMsg state anchor missing')
  if (!s.includes('forwardingMsg'))
    s = s.replace(ST, ST + `\n  const [forwardingMsg, setForwardingMsg] = useState(null)`)

  // 3. onForward handler
  const FWD = `          onForward={(m) => { setActionsForMsg(null); alert("Forward coming soon") }}`
  if (!s.includes(FWD)) throw new Error('onForward anchor missing')
  s = s.replace(FWD, `          onForward={(m) => { setActionsForMsg(null); setForwardingMsg(m) }}`)

  // 4. Render ForwardPicker before closing
  const END = `        />
      )}

      {voice.recording && (`
  if (!s.includes(END)) throw new Error('CommunityChat end anchor missing')

  const PICKER = `        />
      )}

      {forwardingMsg && (
        <ForwardPicker
          message={forwardingMsg}
          onClose={() => setForwardingMsg(null)}
          onForwarded={() => {}}
        />
      )}

      {voice.recording && (`

  s = s.replace(END, PICKER)
  fs.writeFileSync(p, s)
  console.log('OK CommunityChat forward')
}
