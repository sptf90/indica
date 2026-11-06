import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { jsonError, requireCompanyUser } from "@/lib/auth";
import { findAccessibleCompanyForUser } from "@/lib/company";
import { getPool } from "@/lib/db";
import { SPONSOR_BANNER_UPLOAD } from "@/lib/sponsor-banner";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/** POST multipart — banner do ranking (1200×240 / 5:1). */
export async function POST(request) {
  try {
    if (!getPool()) return jsonError("Banco não configurado.", 503);
    const user = await requireCompanyUser();
    const company = await findAccessibleCompanyForUser(user);
    if (!company) return jsonError("Empresa não encontrada.", 404);

    let formData;
    try {
      formData = await request.formData();
    } catch {
      return jsonError("Envie o banner como multipart/form-data.");
    }

    const file = formData.get("banner");
    if (!file || typeof file === "string") {
      return jsonError("Arquivo de banner obrigatório.");
    }

    const type = String(file.type || "").toLowerCase();
    if (!ALLOWED.has(type)) {
      return jsonError("Formato inválido. Use JPG, PNG ou WEBP.");
    }
    if (
      typeof file.size === "number" &&
      file.size > SPONSOR_BANNER_UPLOAD.maxBytes
    ) {
      return jsonError("Banner muito grande (máximo 3 MB).");
    }

    const ext =
      type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });

    const filename = `banner-c${company.id}-${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > SPONSOR_BANNER_UPLOAD.maxBytes) {
      return jsonError("Banner muito grande (máximo 3 MB).");
    }
    await writeFile(path.join(uploadsDir, filename), buffer);

    // /api/uploads/* lê do disco em runtime (next start não serve
    // ficheiros novos em public/uploads até reiniciar).
    const bannerUrl = `/api/uploads/${filename}`;
    return Response.json({
      bannerUrl,
      upload: {
        width: SPONSOR_BANNER_UPLOAD.width,
        height: SPONSOR_BANNER_UPLOAD.height,
        ratio: SPONSOR_BANNER_UPLOAD.ratio,
      },
    });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}
