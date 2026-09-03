import type { Area } from 'react-easy-crop'

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (err) => reject(err))
    image.crossOrigin = 'anonymous'
    image.src = url
  })
}

/** Ritaglia l'immagine sorgente secondo l'area (in pixel) e restituisce una dataURL PNG. */
export async function getCroppedImageDataUrl(imageSrc: string, area: Area): Promise<string> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(area.width)
  canvas.height = Math.round(area.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas non disponibile')

  ctx.drawImage(
    image,
    Math.round(area.x),
    Math.round(area.y),
    Math.round(area.width),
    Math.round(area.height),
    0,
    0,
    Math.round(area.width),
    Math.round(area.height)
  )

  return canvas.toDataURL('image/png')
}

/** Decodifica il QR (se presente) nell'immagine data URL, usando jsQR su un canvas ridotto. */
export async function decodeQrFromDataUrl(imageSrc: string): Promise<string | null> {
  const jsQR = (await import('jsqr')).default
  const image = await createImage(imageSrc)
  const maxDim = 1000
  const scale = Math.min(1, maxDim / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(image.width * scale)
  canvas.height = Math.round(image.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const result = jsQR(imageData.data, imageData.width, imageData.height)
  return result?.data ?? null
}
