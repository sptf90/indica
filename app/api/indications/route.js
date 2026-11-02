import { assertConsumerUser, jsonError, requireUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import {
  createIndication,
  listEligibleRequests,
  listMyIndications,
} from "@/lib/indications-service";

export async function GET(request) {
  try {
    if (!getPool()) return jsonError("Banco não configurado.", 503);
    const user = assertConsumerUser(await requireUser());
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope");

    if (scope === "mine") {
      const items = await listMyIndications(user.id);
      return Response.json({ items });
    }

    const data = await listEligibleRequests(user, {
      cityId: searchParams.get("cityId"),
      cursor: searchParams.get("cursor"),
      limit: searchParams.get("limit"),
    });
    return Response.json(data);
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}

export async function POST(request) {
  try {
    if (!getPool()) return jsonError("Banco não configurado.", 503);
    const user = assertConsumerUser(await requireUser());
    const body = await request.json();
    const requestId = body.requestId;
    if (!requestId) return jsonError("requestId obrigatório.");
    const result = await createIndication(user, requestId, body);
    return Response.json(result, { status: 201 });
  } catch (error) {
    return jsonError(error.message || "Erro", error.status || 500);
  }
}
