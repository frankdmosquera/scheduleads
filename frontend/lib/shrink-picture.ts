// Frontend: a picture made light before it is sent (feature 25e): scaled so its longer side is at
// most `longestSide` pixels (never enlarged) and written as WebP. Where the browser cannot write
// WebP (Safari gives a PNG), the PNG is kept while it fits, so a see-through logo stays see-through,
// and only a larger one becomes JPEG. null when it cannot read the file as a picture.

const FITS = 900_000; // under the API's 1 MB, with room to spare

export async function shrinkPicture(file: File, longestSide: number): Promise<File | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }
  const scale = Math.min(1, longestSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  context?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const encode = (type: string) =>
    new Promise<Blob | null>((done) => canvas.toBlob(done, type, 0.85));
  let blob = await encode("image/webp");
  if (blob && blob.type !== "image/webp" && blob.size > FITS && context) {
    // JPEG has no see-through: white behind the picture, never black.
    context.globalCompositeOperation = "destination-over";
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    blob = await encode("image/jpeg");
  }
  if (!blob) return null;
  const extension = { "image/webp": "webp", "image/png": "png" }[blob.type] ?? "jpg";
  return new File([blob], `picture.${extension}`, { type: blob.type });
}
