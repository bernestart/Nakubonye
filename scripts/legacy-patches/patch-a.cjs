const fs = require('fs')
const p = 'src/screens/ProfileView.jsx'
let s = fs.readFileSync(p, 'utf8')

const old = `          <div className="flex items-start gap-4 -mt-14 relative">`
const neu = `          <div className="flex justify-center -mt-14 relative">`
if (!s.includes(old)) throw new Error('anchor missing')
s = s.replace(old, neu)

// Remove the outer wrapper's padding to allow full centering
const oldWrap = `        <div className="px-4 pb-3">`
const newWrap = `        <div className="pb-3">`
if (s.includes(oldWrap)) s = s.replace(oldWrap, newWrap)

fs.writeFileSync(p, s)
console.log('OK 6C.6a avatar centered')
