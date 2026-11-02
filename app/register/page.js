"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";

export default function RegisterPage() {
  const router = useRouter();
  const [cities, setCities] = useState([]);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cityId, setCityId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api("/api/cities")
      .then((data) => setCities(data.cities || []))
      .catch(() => setCities([]));
  }, []);

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          username,
          email,
          password,
          cityId: Number(cityId),
        }),
      });
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <h1>Cadastrar</h1>
      <p className="lead">Crie sua conta para pedir e fazer indicações.</p>
      <form className="form" onSubmit={onSubmit}>
        <label>
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label>
          Senha
          <span className="hint">Apenas números · mínimo 6 dígitos</span>
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]+"
            title="Apenas números"
            value={password}
            onChange={(e) => setPassword(e.target.value.replace(/\D/g, ""))}
            autoComplete="new-password"
            required
            minLength={6}
            maxLength={128}
          />
        </label>
        <label>
          Cidade
          <select
            value={cityId}
            onChange={(e) => setCityId(e.target.value)}
            required
          >
            <option value="">Selecione</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <button className="cta" type="submit" disabled={loading}>
          {loading ? "Criando…" : "Criar conta"}
        </button>
      </form>
      {error ? <p className="error-box">{error}</p> : null}
      <p className="auth-note">
        Já tem conta? <Link href="/login">Entrar</Link>
      </p>
    </main>
  );
}
