import sharp from 'sharp'
import toIco from 'to-ico'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const src = resolve(__dirname, '../assets/icon-source.png')
const dst = resolve(__dirname, '../assets/icon.ico')

// Read source as PNG via sharp (handles ICO/PNG/JPG input)
const srcBuffer = readFileSync(src)

const sizes = [16, 24, 32, 48, 64, 128, 256]

const pngs = await Promise.all(
  sizes.map(size =>
    sharp(srcBuffer)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
  )
)

const ico = await toIco(pngs)
writeFileSync(dst, ico)
console.log(`icon.ico written (${ico.length} bytes) with sizes: ${sizes.join(', ')}px`)
