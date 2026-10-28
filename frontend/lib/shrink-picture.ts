// Frontend: a picture made light before it is sent (feature 25e): scaled so its longer side is at
// most `longestSide` pixels (never enlarged) and written as WebP, or JPEG where the browser cannot
// write WebP (Safari falls back to a large PNG). null when it cannot read the file as a picture.

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
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const encode = (type: string) =>
    new Promise<Blob | null>((done) => canvas.toBlob(done, type, 0.85));
  let blob = await encode("image/webp");
  if (blob && blob.type !== "image/webp") blob = await encode("image/jpeg");
  if (!blob) return null;
  const extension = blob.type === "image/webp" ? "webp" : "jpg";
  return new File([blob], `picture.${extension}`, { type: blob.type });
}
