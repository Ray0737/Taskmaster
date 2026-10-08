// Draws the app icon (stacked layers on a dark rounded square) and writes build/icon.ico (PNG inside ICO) and build/icon.png.
// Run: node scripts/make-icon.cjs   (no dependencies)
const fs = require('fs')
const zlib = require('zlib')
const path = require('path')

const BG = [11, 11, 14], BG2 = [26, 26, 34], ACCENT = [203, 166, 247]

const inRound = (x, y, r) => { // rounded square on [0,1]
  const dx = Math.max(Math.abs(x - 0.5) - (0.5 - r), 0), dy = Math.max(Math.abs(y - 0.5) - (0.5 - r), 0)
  return dx * dx + dy * dy <= r * r
}
const pixel = (x, y) => { // returns [r,g,b,a] in 0..1 coordinates
  if (!inRound(x, y, 0.22)) return [0, 0, 0, 0]
  let c = BG.map((v, i) => v + (BG2[i] - v) * y)
  const top = Math.abs(x - 0.5) / 0.3 + Math.abs(y - 0.37) / 0.15 <= 1 // top diamond
  let chevron = false
  for (let k = 0; k < 2; k++) {
    const yy = 0.62 + k * 0.14 - Math.abs(x - 0.5) * 0.5
    if (Math.abs(x - 0.5) <= 0.3 && Math.abs(y - yy) <= 0.032) chevron = true
  }
  if (top || chevron) c = ACCENT
  return [c[0], c[1], c[2], 255]
}

const render = (size) => {
  const S = 3, rgba = Buffer.alloc(size * size * 4)
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    let r = 0, g = 0, b = 0, a = 0
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const p = pixel((px + (sx + 0.5) / S) / size, (py + (sy + 0.5) / S) / size)
      const w = p[3] / 255
      r += p[0] * w; g += p[1] * w; b += p[2] * w; a += w
    }
    const o = (py * size + px) * 4, n = S * S
    rgba[o] = a ? Math.round(r / a) : 0; rgba[o + 1] = a ? Math.round(g / a) : 0; rgba[o + 2] = a ? Math.round(b / a) : 0; rgba[o + 3] = Math.round((a / n) * 255)
  }
  return rgba
}

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
const png = (size) => {
  const rgba = render(size), raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4) }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

const sizes = [256, 64, 48, 32, 16]
const pngs = sizes.map(png)
const head = Buffer.alloc(6); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4)
let offset = 6 + sizes.length * 16
const dir = Buffer.concat(sizes.map((s, i) => {
  const e = Buffer.alloc(16)
  e[0] = s === 256 ? 0 : s; e[1] = s === 256 ? 0 : s; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6)
  e.writeUInt32LE(pngs[i].length, 8); e.writeUInt32LE(offset, 12); offset += pngs[i].length
  return e
}))
const out = path.join(__dirname, '..', 'build')
fs.mkdirSync(out, { recursive: true })
fs.writeFileSync(path.join(out, 'icon.ico'), Buffer.concat([head, dir, ...pngs]))
fs.writeFileSync(path.join(out, 'icon.png'), pngs[0])
console.log('wrote build/icon.ico and build/icon.png')
