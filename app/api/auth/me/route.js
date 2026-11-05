import {
  findUserById,
  getCurrentUser,
  jsonError,
  publicUser,
  withAdminView,
} from "@/lib/auth";
import { sumPointsAcrossActiveEnrollments } from "@/lib/rankings";
import { ensureUserShareCode } from "@/lib/share-links";

export async function GET() {
  let user = await getCurrentUser();
  if (!user) return jsonError("Não autenticado.", 401);
  if (!user.share_code) {
    await ensureUserShareCode(user.id);
    user = (await withAdminView(await findUserById(user.id))) || user;
  }
  const points = await sumPointsAcrossActiveEnrollments(user.id);
  return Response.json({
    user: {
      ...publicUser(user),
      points,
      score: points,
    },
  });
}
