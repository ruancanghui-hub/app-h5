export interface CompressOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  mimeType?: string
  maxBytes?: number
}

const DEFAULTS: Required<CompressOptions> = {
  maxWidth: 1280,
  maxHeight: 1280,
  quality: 0.8,
  mimeType: 'image/jpeg',
  maxBytes: 5 * 1024 * 1024,
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = src
  })
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('图片压缩失败'))
          return
        }
        resolve(blob)
      },
      type,
      quality,
    )
  })
}

export async function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<File> {
  const opts = { ...DEFAULTS, ...options }
  if (file.size > opts.maxBytes) {
    throw new Error(`单张图片不能超过 ${Math.round(opts.maxBytes / 1024 / 1024)}MB`)
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await loadImage(objectUrl)
    let { width, height } = img
    const ratio = Math.min(opts.maxWidth / width, opts.maxHeight / height, 1)
    width = Math.round(width * ratio)
    height = Math.round(height * ratio)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('图片压缩不可用')
    ctx.drawImage(img, 0, 0, width, height)

    let quality = opts.quality
    let blob = await canvasToBlob(canvas, opts.mimeType, quality)
    while (blob.size > 800 * 1024 && quality > 0.5) {
      quality -= 0.1
      blob = await canvasToBlob(canvas, opts.mimeType, quality)
    }

    const name = file.name.replace(/\.\w+$/, '') + '.jpg'
    return new File([blob], name, { type: opts.mimeType, lastModified: Date.now() })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
