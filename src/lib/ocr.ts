import { createWorker } from 'tesseract.js'

export type OcrProgressCallback = (progress: number, status: string) => void

/**
 * Riconosce testo da un'immagine (dataURL) con un whitelist di caratteri opzionale,
 * utile per aumentare l'affidabilità su campi strutturati (es. sole cifre per il voto).
 */
export async function recognizeText(
  imageDataUrl: string,
  options: { whitelist?: string; lang?: string; singleLine?: boolean } = {},
  onProgress?: OcrProgressCallback
): Promise<string> {
  const { whitelist, lang = 'ita', singleLine = true } = options
  const worker = await createWorker(lang, 1, {
    logger: (m) => {
      if (onProgress) onProgress(m.progress, m.status)
    },
  })
  try {
    await worker.setParameters({
      tessedit_char_whitelist: whitelist ?? '',
      tessedit_pageseg_mode: singleLine ? ('7' as never) : ('6' as never),
    })
    const {
      data: { text },
    } = await worker.recognize(imageDataUrl)
    return text.trim()
  } finally {
    await worker.terminate()
  }
}
