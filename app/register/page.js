"use client";

import MobileHelp from "@/components/MobileHelp";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import IbgeCityPicker from "@/components/IbgeCityPicker";
import { api } from "@/lib/client-api";
import { maskCnpjInput } from "@/lib/cnpj";

export default function RegisterPage() {
  const router = useRouter();
  const [accountType, setAccountType] = useState("user");
  const isCompany = accountType === "company";
  const [cnpj, setCnpj] = useState("");
  const [legalName, setLegalName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState("");
  const [cityName, setCityName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    if (!state || !cityName) {
      setError("Selecione o estado e a cidade.");
      return;
    }
    setLoading(true);
    try {
      const account = isCompany
        ? { cnpj, legalName, logoUrl: logoUrl.trim(), createNew: true }
        : { username };
      await api(isCompany ? "/api/auth/register-company" : "/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          ...account,
          email,
          password,
          state,
          cityName,
        }),
      });
      router.push(isCompany ? "/empresa" : "/");
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <MobileHelp
        className="lead" label="Qual conta devo criar?"
        heading={
          <h1>Cadastrar</h1>
        }
      >
        {isCompany
          ? "Cadastre sua empresa para solicitar patrocínio de rankings na sua cidade."
          : "Crie sua conta para pedir e fazer indicações."}
      </MobileHelp>
      <form className="form" onSubmit={onSubmit}>
        <label>
          Tipo de conta
          <select
            value={accountType}
            disabled={loading}
            onChange={(event) => {
              setAccountType(event.target.value);
              setError("");
            }}
          >
            <option value="user">Pessoa física</option>
            <option value="company">Empresa patrocinadora</option>
          </select>
        </label>
        {isCompany ? (
          <>
            <label>
              Razão social
              <input
                value={legalName}
                onChange={(event) => setLegalName(event.target.value)}
                autoComplete="organization"
                minLength={2}
                maxLength={255}
                required
              />
            </label>
            <label>
              CNPJ
              <input
                value={cnpj}
                onChange={(event) => setCnpj(maskCnpjInput(event.target.value))}
                inputMode="numeric"
                minLength={18}
                required
              />
            </label>
            <label>
              Link do logotipo (opcional)
              <span className="hint">Cole o endereço da imagem para exibir sua marca no ranking.</span>
              <input
                type="url"
                value={logoUrl}
                onChange={(event) => setLogoUrl(event.target.value)}
                placeholder="https://suaempresa.com.br/logo.png"
                maxLength={500}
              />
            </label>
          </>
        ) : (
          <label>
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
        )}
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

        <IbgeCityPicker
          state={state}
          cityName={cityName}
          onChange={({ state: nextState, cityName: nextCity }) => {
            setState(nextState);
            setCityName(nextCity);
          }}
          required
        />

        <button className="cta" type="submit" disabled={loading}>
          {loading ? "Criando…" : isCompany ? "Criar conta empresarial" : "Criar conta"}
        </button>
      </form>
      {error ? <p className="error-box" role="alert">{error}</p> : null}
      <p className="auth-note">
        Já tem conta? <Link href="/login">Entrar</Link>
      </p>
    </main>
  );
}
