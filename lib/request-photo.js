export const REQUEST_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const REQUEST_PHOTO_MAX_MB = 5;
export const REQUEST_PHOTO_MAX_BYTES = REQUEST_PHOTO_MAX_MB * 1024 * 1024;
export const REQUEST_PHOTO_HINT = `JPG, PNG, WEBP ou GIF, até ${REQUEST_PHOTO_MAX_MB} MB.`;

export function requestPhotoError(file) {
  if (!REQUEST_PHOTO_TYPES.includes(file.type)) return "Use uma imagem JPG, PNG, WEBP ou GIF.";
  if (!file.size) return "A foto está vazia.";
  if (file.size > REQUEST_PHOTO_MAX_BYTES) return `A foto deve ter até ${REQUEST_PHOTO_MAX_MB} MB.`;
  return null;
}
