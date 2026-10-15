export async function prepareProfilePhoto(file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose an image file.')
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Photo must be smaller than 10 MB.')
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = objectUrl
    await image.decode()
    const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Photo could not be prepared. Try another image.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const compressed = canvas.toDataURL('image/jpeg', 0.8)
    if (compressed.length > 400_000) {
      throw new Error('Photo is still too large. Choose a smaller image.')
    }
    return compressed
  } catch (error) {
    throw new Error(error.message || 'Photo could not be opened. Try another image.')
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
