import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { jsonError } from "@/lib/auth";

const SAFE_NAME = /^[A-Za-z0-9._-]+$/;
const MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/**
 * Serve ficheiros de public/uploads em runtime.
 * next start só serve estáticos que existiam ao arrancar — uploads
 * posteriores em /uploads/* davam 404; esta rota lê do disco sempre.
 */
export async function GET(_request, { params }) {
  try {
    const name = String((await params).name || "");
    if (!name || !SAFE_NAME.test(name) || name.includes("..")) {
      return jsonError("Arquivo inválido.", 400);
    }

    const filePath = path.join(process.cwd(), "public", "uploads", name);
    const uploadsRoot = path.join(process.cwd(), "public", "uploads");
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(uploadsRoot) + path.sep)) {
      return jsonError("Arquivo inválido.", 400);
    }

    let info;
    try {
      info = await stat(resolved);
    } catch {
      return jsonError("Arquivo não encontrado.", 404);
    }
    if (!info.isFile()) return jsonError("Arquivo não encontrado.", 404);

    const ext = path.extname(name).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    const buffer = await readFile(resolved);

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": type,
        "Content-Length": String(buffer.length),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}
