import { assertConsumerUser, jsonError, requireUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { createRequest, listMyRequests } from "@/lib/requests-service";

export async function GET() {
  try {
    if (!getPool()) return jsonError("Banco não configurado.", 503);
    const user = assertConsumerUser(await requireUser());
    const items = await listMyRequests(user.id);
    return Response.json({ items });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}

export async function POST(request) {
  try {
    if (!getPool()) return jsonError("Banco não configurado.", 503);
    const user = assertConsumerUser(await requireUser());
    const body = await request.json();
    const item = await createRequest(user, body);
    return Response.json({ item }, { status: 201 });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}
