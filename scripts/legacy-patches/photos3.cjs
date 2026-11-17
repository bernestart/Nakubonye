const { Jimp } = require('jimp')
const path = require('path')
const fs = require('fs')

const SRC = '/sdcard/nakubonye photos'
const OUT = 'public/illustrations'

// Clean old images first
fs.readdirSync(OUT).forEach(f => {
  if (f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png')) {
    fs.unlinkSync(path.join(OUT, f))
  }
})

const files = [
  { src: '1787434052676-01-01.jpeg',                             slot: 'welcome.jpg'  },
  { src: 'image_1771573801397443-01.jpeg',                       slot: 'audience.jpg' },
  { src: 'IMG_20260808_204023.jpg',                              slot: 'frame.jpg'    },
  { src: 'IMG_20260827_120845-01_edit_52103876899861.jpg',       slot: 'entry.jpg'    },
  { src: 'IMG_20260726_093414-01_edit_13500154032313-01.jpeg',   slot: 'finish.jpg'   },
]

;(async () => {
  for (const { src, slot } of files) {
    const srcPath = path.join(SRC, src)
    if (!fs.existsSync(srcPath)) { console.error('❌ missing:', src); continue }
    try {
      const img = await Jimp.read(srcPath)
      const w = img.bitmap.width, h = img.bitmap.height
      if (w >= h) img.resize({ w: 900 })
      else img.resize({ h: 900 })
      await img.write(path.join(OUT, slot), { quality: 82 })
      console.log('✅', src, '→', slot)
    } catch (e) { console.error('❌', src, e.message) }
  }
  console.log('\n--- final folder ---')
  fs.readdirSync(OUT).forEach(f => {
    const sz = (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0)
    console.log(`  ${f}  ${sz}KB`)
  })
})()
