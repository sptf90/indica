import { redirect } from "next/navigation";

/** Alias PT-BR da rota real de registro. */
export default function CadastroPage() {
  redirect("/register");
}
