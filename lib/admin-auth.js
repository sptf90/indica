import { isAdminAccount, requireAdminUser } from "./auth";

/** As prévias de usuário/empresa não recebem os dados da gestão completa. */
export async function requireManagementAdmin() {
  const user = await requireAdminUser();
  if (!isAdminAccount(user)) throw Object.assign(new Error("Volte à gestão admin para acessar esta área."), { status: 403 });
  return user;
}
