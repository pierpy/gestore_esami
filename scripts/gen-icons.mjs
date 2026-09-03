// Genera icone PWA (PNG) senza dipendenze esterne: sfondo indigo + spunta bianca.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

function crc32(buf) {
  let c
  const table = crc32.table ?? (crc32.table = (() => {
    const t = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[n] = c
    }
    return t
  })())
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function distToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax
  const aby = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby)))
  const cx = ax + t * abx
  const cy = ay + t * aby
  return Math.hypot(px - cx, py - cy)
}

function generatePng(size) {
  const bg = [99, 102, 241] // #6366f1
  const fg = [255, 255, 255]
  const raw = Buffer.alloc((size * 4 + 1) * size)

  // spunta: due segmenti che formano un check, in coordinate relative 0..1
  const p1 = [0.24, 0.53]
  const p2 = [0.42, 0.72]
  const p3 = [0.78, 0.3]
  const thickness = size * 0.075

  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1)
    raw[rowStart] = 0 // filter type: none
    for (let x = 0; x < size; x++) {
      const d1 = distToSegment(x, y, p1[0] * size, p1[1] * size, p2[0] * size, p2[1] * size)
      const d2 = distToSegment(x, y, p2[0] * size, p2[1] * size, p3[0] * size, p3[1] * size)
      const isCheck = d1 < thickness || d2 < thickness
      const [r, g, b] = isCheck ? fg : bg
      const idx = rowStart + 1 + x * 4
      raw[idx] = r
      raw[idx + 1] = g
      raw[idx + 2] = b
      raw[idx + 3] = 255
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const idat = deflateSync(raw)

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync('public/icons', { recursive: true })
for (const size of [64, 180, 192, 512]) {
  writeFileSync(`public/icons/icon-${size}.png`, generatePng(size))
}
console.log('Icone generate in public/icons')
