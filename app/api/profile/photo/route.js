import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import {
  findUserById,
  jsonError,
  publicUser,
  requireUser,
  withAdminView,
} from "@/lib/auth";
import { getPool } from "@/lib/db";
import { updateOwnProfile } from "@/lib/profile";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/** POST multipart — upload simples para public/uploads (foto de perfil). */
export async function POST(request) {
  try {
    if (!getPool()) return jsonError("Banco não configurado.", 503);
    const user = await requireUser();

    let formData;
    try {
      formData = await request.formData();
    } catch {
      return jsonError("Envie a foto como multipart/form-data.");
    }

    const file = formData.get("photo");
    if (!file || typeof file === "string") {
      return jsonError("Arquivo de foto obrigatório.");
    }

    const type = String(file.type || "").toLowerCase();
    if (!ALLOWED.has(type)) {
      return jsonError("Formato inválido. Use JPG, PNG, WEBP ou GIF.");
    }
    if (typeof file.size === "number" && file.size > MAX_BYTES) {
      return jsonError("Foto muito grande (máximo 2 MB).");
    }

    const ext =
      type === "image/png"
        ? "png"
        : type === "image/webp"
          ? "webp"
          : type === "image/gif"
            ? "gif"
            : "jpg";

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });

    const filename = `u${user.id}-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > MAX_BYTES) {
      return jsonError("Foto muito grande (máximo 2 MB).");
    }
    await writeFile(path.join(uploadsDir, filename), buffer);

    const photoUrl = `/uploads/${filename}`;
    await updateOwnProfile(user.id, { photoUrl });
    const updated = await withAdminView(await findUserById(user.id));
    return Response.json({ user: publicUser(updated), photoUrl });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}
