import { jsonError } from "@/lib/auth";
import { requireManagementAdmin } from "@/lib/admin-auth";
import { getAdminRecord, updateAdminRecord } from "@/lib/admin-service";
export async function GET(_request, { params }) {
  try {
    const user = await requireManagementAdmin();
    const { section, id } = await params;
    return Response.json(await getAdminRecord(section, id, user.id), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error.message || "Não foi possível carregar o registro.", error.status || 500); }
}
export async function PATCH(request, { params }) {
  try {
    const user = await requireManagementAdmin();
    const { section, id } = await params;
    let body;
    try { body = await request.json(); } catch { return jsonError("JSON inválido.", 400); }
    await updateAdminRecord(user, section, id, body);
    return Response.json(await getAdminRecord(section, id, user.id), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error.message || "Não foi possível salvar o cadastro.", error.status || 500); }
}
