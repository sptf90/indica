"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api } from "@/lib/client-api";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justDeleted = searchParams.get("deleted") === "1";
  const nextPath = searchParams.get("next") || "/";
  const safeNext =
    nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/";
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ login, password }),
      });
      const dest =
        data?.user?.isAdmin && safeNext === "/"
          ? "/admin"
          : data?.user?.isCompany && safeNext === "/"
            ? "/empresa"
            : safeNext;
      router.push(dest);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <h1>Entrar</h1>
      <p className="lead">Acesse sua conta Indica.</p>
      {justDeleted ? (
        <p className="ok-box" data-testid="account-deleted-notice">
          Conta excluída. Você pode criar um cadastro novo com o mesmo e-mail
          ou username — o histórico anterior não é restaurado.
        </p>
      ) : null}
      <form className="form" onSubmit={onSubmit}>
        <label>
          E-mail ou username
          <input
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          Senha
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <button className="cta" type="submit" disabled={loading}>
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
      {error ? <p className="error-box">{error}</p> : null}
      <p className="auth-note">
        Não tem conta? <Link href="/register">Cadastre-se</Link>
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="page">
          <p className="muted">Carregando…</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
