import {
  findUserById,
  jsonError,
  publicUser,
  requireUser,
} from "@/lib/auth";
import { getPool } from "@/lib/db";
import { updateOwnProfile } from "@/lib/profile";

/** PATCH — editar próprio username, foto e cidade. */
export async function PATCH(request) {
  try {
    if (!getPool()) return jsonError("Banco não configurado.", 503);
    const user = await requireUser();

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonError("JSON inválido.");
    }

    const payload = {};
    if (Object.prototype.hasOwnProperty.call(body, "username")) {
      payload.username = body.username;
    }
    if (Object.prototype.hasOwnProperty.call(body, "photoUrl")) {
      payload.photoUrl = body.photoUrl;
    }
    if (Object.prototype.hasOwnProperty.call(body, "cityId")) {
      payload.cityId = body.cityId;
    }
    await updateOwnProfile(user.id, payload);

    const updated = await findUserById(user.id);
    return Response.json({ user: publicUser(updated) });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}
