import { requestPhotoError, REQUEST_PHOTO_MAX_BYTES } from "./request-photo";

const signatures = {
  "image/jpeg": (bytes) => bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  "image/png": (bytes) => bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/webp": (bytes) => bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP",
  "image/gif": (bytes) => ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6)),
};

export function requestPhotoUrl(requestId) {
  return `/api/requests/${requestId}/photo`;
}

export async function readNewRequest(request) {
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) {
    return { body: await request.json(), photo: null };
  }

  const fail = (message, status = 400) => {
    throw Object.assign(new Error(message), { status });
  };
  if (Number(request.headers.get("content-length")) > REQUEST_PHOTO_MAX_BYTES + 128 * 1024) {
    fail("O envio ultrapassou o limite de tamanho.", 413);
  }

  const form = await request.formData().catch(() => fail("Não foi possível ler o formulário do pedido."));
  const files = form.getAll("photo");
  if (files.length > 1) fail("Anexe apenas uma foto ao pedido.");

  const body = Object.fromEntries(
    ["title", "details", "cityId", "contactMode"].map((field) => [field, form.get(field)])
  );
  if (!files.length) return { body, photo: null };

  const [file] = files;
  if (typeof file === "string") fail("Anexe um arquivo de imagem.");
  const error = requestPhotoError(file);
  if (error) fail(error, file.size > REQUEST_PHOTO_MAX_BYTES ? 413 : 400);

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!signatures[file.type](bytes)) fail("O conteúdo da foto não corresponde ao formato informado.");

  return { body, photo: { type: file.type, bytes } };
}
