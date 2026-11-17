const fs = require('fs')
const path = require('path')

const srcDir = 'src'
const files = []
function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f)
    const st = fs.statSync(full)
    if (st.isDirectory()) walk(full)
    else if (f.endsWith('.jsx') || f.endsWith('.js')) files.push(full)
  }
}
walk(srcDir)

const problems = []
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8')
  const lines = src.split('\n')

  // Detect `xxx` used in JSX {xxx} or setXxx() calls without a useState/const/let/import
  const declared = new Set()
  const imports = new Set()
  const used = new Map()

  lines.forEach((line, i) => {
    // imports
    const imp = line.match(/import\s+(?:{[^}]+}|\w+|\*\s+as\s+\w+)\s+from/)
    if (imp) {
      const names = line.match(/[{,]\s*(\w+)|^\s*import\s+(\w+)/g) || []
      names.forEach(n => {
        const m = n.match(/(\w+)/)
        if (m) imports.add(m[1])
      })
    }
    // useState/useRef/useCallback declarations
    const dec = line.match(/(?:const|let|var)\s+(\w+)\s*[=,]/g) || []
    dec.forEach(d => {
      const m = d.match(/(\w+)\s*[=,]/)
      if (m) declared.add(m[1])
    })
    // destructured props/consts
    const dest = line.match(/const\s+{([^}]+)}/)
    if (dest) {
      dest[1].split(',').forEach(p => {
        const m = p.trim().match(/^(\w+)/)
        if (m) declared.add(m[1])
      })
    }
    const destArr = line.match(/const\s+\[([^\]]+)\]/)
    if (destArr) {
      destArr[1].split(',').forEach(p => {
        const m = p.trim().match(/^(\w+)/)
        if (m) declared.add(m[1])
      })
    }

    // JSX {identifier}
    const jsxUse = line.match(/{([a-zA-Z_]\w*)\s*[})]/g) || []
    jsxUse.forEach(u => {
      const m = u.match(/{(\w+)/)
      if (m) {
        const name = m[1]
        if (!used.has(name)) used.set(name, [])
        used.get(name).push({ file, line: i + 1 })
      }
    })
  })

  // Report undefined references
  used.forEach((locations, name) => {
    // Skip JS keywords and common globals
    const skip = ['true','false','null','undefined','Math','JSON','Object','Array','String','Number','Date','Promise','console','window','document','alert','confirm','crypto','URL','Blob','File','FormData','Set','Map','fetch','setTimeout','setInterval','clearTimeout','clearInterval','parseInt','parseFloat','isNaN','Boolean','Symbol','WeakMap','WeakSet','Proxy','Reflect','Intl','Promise','Error','TypeError','encodeURI','decodeURI','encodeURIComponent','decodeURIComponent','navigator','localStorage','sessionStorage','location','history','atob','btoa']
    if (skip.includes(name)) return
    if (declared.has(name)) return
    if (imports.has(name)) return
    // some are props / function params — we can't easily detect those, so only flag
    // if the file doesn't contain the name as a parameter or let/var/const anywhere
    const anywhere = src.match(new RegExp(`\\b${name}\\b`, 'g')) || []
    const declPattern = new RegExp(`(?:const|let|var|function|class)\\s+${name}\\b|[{(,]\\s*${name}\\s*[,})]`)
    if (!declPattern.test(src)) {
      locations.forEach(loc => problems.push({ ...loc, name }))
    }
  })
}

// Dedupe by file:line:name
const seen = new Set()
const unique = problems.filter(p => {
  const k = `${p.file}:${p.line}:${p.name}`
  if (seen.has(k)) return false
  seen.add(k)
  return true
})

console.log(`Scanned ${files.length} files. Found ${unique.length} potential undefined references:\n`)
unique.slice(0, 100).forEach(p => {
  console.log(`${p.file}:${p.line}  →  ${p.name}`)
})
console.log(`\nTotal: ${unique.length}`)
