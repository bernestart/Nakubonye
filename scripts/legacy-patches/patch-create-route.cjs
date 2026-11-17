const fs = require('fs')
const p = 'src/App.jsx'
let s = fs.readFileSync(p, 'utf8')
const IMP = "import Marketplace from './screens/Marketplace'"
if (!s.includes(IMP)) throw new Error('import anchor missing')
if (!s.includes('CreateListing'))
  s = s.replace(IMP, IMP + "\nimport CreateListing from './screens/CreateListing'")
const ROUTE = `<Route path="/marketplace" element={<Guard><Marketplace /></Guard>} />`
if (!s.includes(ROUTE)) throw new Error('route anchor missing')
if (!s.includes('path="/marketplace/new"'))
  s = s.replace(ROUTE, `${ROUTE}
        <Route path="/marketplace/new" element={<Guard><CreateListing /></Guard>} />`)
fs.writeFileSync(p, s)
console.log('OK create route added')
