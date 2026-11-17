const fs = require('fs')
const p = 'src/App.jsx'
let s = fs.readFileSync(p, 'utf8')

const IMP = "import Marketplace from './screens/Marketplace'"
if (!s.includes(IMP)) throw new Error('import anchor missing')
if (!s.includes('ListingDetail'))
  s = s.replace(IMP, IMP + "\nimport ListingDetail from './screens/ListingDetail'")

const ROUTE = `<Route path="/marketplace/new" element={<Guard><CreateListing /></Guard>} />`
if (!s.includes(ROUTE)) throw new Error('create listing route anchor missing')
if (!s.includes('path="/marketplace/:id"'))
  s = s.replace(ROUTE, `${ROUTE}
        <Route path="/marketplace/:id" element={<Guard><ListingDetail /></Guard>} />`)

fs.writeFileSync(p, s)
console.log('OK ListingDetail route added')
