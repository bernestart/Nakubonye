const { Jimp } = require('jimp')
const path = require('path')
const fs = require('fs')

const SRC = '/sdcard/Pictures'
const OUT = 'public/illustrations'

const files = [
  { src: 'IMG_20260726_093414-01_edit_13500154032313-01.jpeg', slot: 'welcome.jpg' },
  { src: 'image_1771573801397443-01.jpeg',                      slot: 'audience.jpg' },
  { src: 'IMG_20260827_120839-01_edit_33353039860013.jpg',      slot: 'frame.jpg' },
  { src: 'IMG_20260808_204023.jpg',                             slot: 'finish.jpg' },
]

;(async () => {
  for (const { src, slot } of files) {
    const srcPath = path.join(SRC, src)
    if (!fs.existsSync(srcPath)) { console.error('❌ missing:', src); continue }
    try {
      const img = await Jimp.read(srcPath)
      const w = img.bitmap.width, h = img.bitmap.height
      if (w >= h) img.resize({ w: 800 })
      else img.resize({ h: 800 })
      await img.write(path.join(OUT, slot), { quality: 80 })
      console.log('✅', src, '→', slot)
    } catch (e) { console.error('❌', src, e.message) }
  }
})()
