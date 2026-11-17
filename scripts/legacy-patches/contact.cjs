const { Jimp } = require('jimp')
const path = require('path')
const fs = require('fs')

const SRC = '/sdcard/Pictures'
const files = fs.readdirSync(SRC)
  .filter(f => /\.(jpe?g|png)$/i.test(f))
  .sort()

const CELL = 220
const COLS = 4
const rows = Math.ceil(files.length / COLS)
const W = CELL * COLS
const H = CELL * rows

;(async () => {
  const sheet = new Jimp({ width: W, height: H, color: 0x101018ff })
  let placed = 0
  for (let i = 0; i < files.length; i++) {
    const f = files[i]
    const x = (i % COLS) * CELL
    const y = Math.floor(i / COLS) * CELL
    try {
      const img = await Jimp.read(path.join(SRC, f))
      img.cover({ w: CELL, h: CELL })
      sheet.composite(img, x, y)
      placed++
    } catch (e) { console.log('skip', f, e.message) }
  }
  await sheet.write('/sdcard/Download/contact-sheet.jpg', { quality: 85 })
  console.log('✅ sheet written to /sdcard/Download/contact-sheet.jpg')
  console.log('placed:', placed, 'of', files.length)
  console.log('---')
  console.log('Left-to-right, top-to-bottom = numbers 1, 2, 3, ...')
  console.log('Grid is 4 columns.')
  files.forEach((f, i) => console.log(`${i + 1}. ${f}`))
})()
