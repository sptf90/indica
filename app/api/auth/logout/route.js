import { clearAdminViewCookie } from "@/lib/admin-view";
import { clearSessionCookie } from "@/lib/session";

export async function POST() {
  await clearSessionCookie();
  await clearAdminViewCookie();
  return Response.json({ ok: true });
}
