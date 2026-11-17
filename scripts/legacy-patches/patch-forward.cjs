const fs = require('fs')
const p = 'src/screens/Chat.jsx'
let s = fs.readFileSync(p, 'utf8')

// 1. Import
const IMP_ANCHOR = `import MessageActionsSheet from '../components/MessageActionsSheet'`
if (!s.includes(IMP_ANCHOR)) throw new Error('MessageActionsSheet import anchor missing')
if (!s.includes('ForwardPicker'))
  s = s.replace(IMP_ANCHOR, IMP_ANCHOR + `\nimport ForwardPicker from '../components/ForwardPicker'`)

// 2. State
const ST_ANCHOR = `  const [actionsForMsg, setActionsForMsg] = useState(null)`
if (!s.includes(ST_ANCHOR)) throw new Error('actionsForMsg anchor missing')
if (!s.includes('forwardingMsg'))
  s = s.replace(ST_ANCHOR, ST_ANCHOR + `\n  const [forwardingMsg, setForwardingMsg] = useState(null)`)

// 3. Wire onForward
const FORWARD_OLD = `          onForward={(m) => alert("Forward coming soon")}`
if (!s.includes(FORWARD_OLD)) throw new Error('onForward anchor missing')
s = s.replace(FORWARD_OLD, `          onForward={(m) => { setActionsForMsg(null); setForwardingMsg(m) }}`)

// 4. Render picker after the sheet
const SHEET_END = `        />
      )}
    </div>`
const si = s.lastIndexOf(SHEET_END)
if (si < 0) throw new Error('sheet end anchor missing')

const PICKER = `        />
      )}

      {forwardingMsg && (
        <ForwardPicker
          message={forwardingMsg}
          onClose={() => setForwardingMsg(null)}
          onForwarded={() => {
            // Optional: toast or silent
          }}
        />
      )}
    </div>`

s = s.slice(0, si) + PICKER + s.slice(si + SHEET_END.length)

fs.writeFileSync(p, s)
console.log('OK forward wired')
