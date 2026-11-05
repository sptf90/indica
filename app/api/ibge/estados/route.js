import { jsonError } from "@/lib/auth";
import { listEstados } from "@/lib/ibge";

export async function GET() {
  try {
    const estados = await listEstados();
    return Response.json({ estados });
  } catch (error) {
    return jsonError(error.message || "Erro ao listar estados.", error.status || 500);
  }
}
