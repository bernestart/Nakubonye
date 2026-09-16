const fs = require('fs')

const files = ['src/screens/Terms.jsx', 'src/screens/Privacy.jsx']

for (const p of files) {
  let s = fs.readFileSync(p, 'utf8')
  const orig = s

  // Anchor: <span className="text-subtle">WhatsApp:</span> <span className="font-semibold">+257 65 39 40 84</span>
  const oldSpan = '<span className="text-subtle">WhatsApp:</span> <span className="font-semibold">+257 65 39 40 84</span>'
  const newAnchor = '<span className="text-subtle">WhatsApp:</span> <a href="https://wa.me/25765394084" target="_blank" rel="noopener" className="font-semibold text-purple-300">+257 65 39 40 84</a>'

  if (s.includes(oldSpan)) {
    s = s.replace(oldSpan, newAnchor)
    fs.writeFileSync(p, s)
    console.log('  OK  ' + p + ' — WhatsApp now tappable')
  } else if (s.includes('https://wa.me/25765394084')) {
    console.log('  SKIP ' + p + ' — already tappable')
  } else {
    console.log('  WARN ' + p + ' — anchor text not found')
  }
}
