const { Jimp } = require('jimp')
const path = require('path')

const dir = 'public/illustrations'
const targets = {
  'IMG_20261001_170901.jpg': 'welcome.jpg',
  'IMG_20261001_170418.jpg': 'audience.jpg',
  'IMG_20261001_170414.jpg': 'frame.jpg',
  'IMG_20261001_170411.jpg': 'finish.jpg',
}

;(async () => {
  for (const [src, dst] of Object.entries(targets)) {
    try {
      const img = await Jimp.read(path.join(dir, src))
      // Resize longest side to 800px
      const w = img.bitmap.width
      const h = img.bitmap.height
      if (w > 800 || h > 800) {
        if (w >= h) img.resize({ w: 800 })
        else img.resize({ h: 800 })
      }
      // Quality 80 JPEG
      await img.write(path.join(dir, dst), { quality: 80 })
      console.log(`✅ ${src} → ${dst}`)
    } catch (e) {
      console.error(`❌ ${src}:`, e.message)
    }
  }
})()
