import { LATO_LUNGO_MAX, PESO_MAX_ORIGINALE } from '#shared/immagini'

// Rimpicciolisce nel browser la foto scelta (convenzioni, comunicazioni) prima di salvarla:
// al massimo 1200 px sul lato lungo, JPEG all'82%, senza deformarla. Le regole sono in
// shared/immagini.ts. Un file oltre i 10 MB non si carica nemmeno: messaggio e basta.
export function ridimensionaImmagine(file: File): Promise<string> {
  if (file.size > PESO_MAX_ORIGINALE) {
    return Promise.reject(new Error(`La foto pesa ${(file.size / 1024 / 1024).toFixed(1)} MB: il massimo è 10 MB.`))
  }
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scala = Math.min(1, LATO_LUNGO_MAX / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scala)
      canvas.height = Math.round(img.height * scala)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Immagine non leggibile: scegli un file JPG o PNG.')) }
    img.src = url
  })
}
