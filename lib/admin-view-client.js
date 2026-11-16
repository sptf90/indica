import { api } from "./client-api";

/** Compartilhado pela entrada nas prévias e pelo retorno à gestão. */
export async function changeAdminView(mode) {
  const result = await api("/api/admin/view-as", { method: "POST", body: JSON.stringify({ mode }) });
  window.dispatchEvent(new Event("goindica:auth-changed"));
  return result.redirectTo || (mode === "admin" ? "/admin" : mode === "company" ? "/empresa" : "/");
}
