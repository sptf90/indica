export const REQUEST_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const REQUEST_PHOTO_MAX_MB = 5;
export const REQUEST_PHOTO_MAX_BYTES = REQUEST_PHOTO_MAX_MB * 1024 * 1024;
export const REQUEST_PHOTO_HINT = `JPG, PNG, WEBP ou GIF, até ${REQUEST_PHOTO_MAX_MB} MB.`;

const CAMERA_MAX_SIDE = 1920;

// Fotos tiradas na câmera costumam passar de 5 MB; reduz e converte para JPEG antes de validar.
export async function shrinkCameraPhoto(file) {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const scale = Math.min(1, CAMERA_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) return file;
    return new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}

export function requestPhotoError(file) {
  if (!REQUEST_PHOTO_TYPES.includes(file.type)) return "Use uma imagem JPG, PNG, WEBP ou GIF.";
  if (!file.size) return "A foto está vazia.";
  if (file.size > REQUEST_PHOTO_MAX_BYTES) return `A foto deve ter até ${REQUEST_PHOTO_MAX_MB} MB.`;
  return null;
}
