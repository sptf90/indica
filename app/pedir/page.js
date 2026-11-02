"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client-api";

const DRAFT_KEY = "indica_request_draft";

const TIPS = [
  "Seja específico",
  "Inclua bairro se ajudar",
  "Diga o que importa pra você",
];

export default function PedirPage() {
  const router = useRouter();
  const [cities, setCities] = useState([]);
  const [me, setMe] = useState(null);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [cityId, setCityId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api("/api/cities"), api("/api/auth/me")])
      .then(([citiesData, meData]) => {
        setCities(citiesData.cities || []);
        setMe(meData.user);
        const draft =
          typeof window !== "undefined"
            ? sessionStorage.getItem(DRAFT_KEY)
            : null;
        if (draft) {
          try {
            const parsed = JSON.parse(draft);
            setTitle(parsed.title || "");
            setDetails(parsed.details || "");
            setCityId(String(parsed.cityId || meData.user?.cityId || ""));
            return;
          } catch {
            // ignore
          }
        }
        setCityId(String(meData.user?.cityId || ""));
      })
      .catch((err) => {
        if (err.status === 401) router.push("/login");
        else setError(err.message);
      });
  }, [router]);

  function goPreview(event) {
    event.preventDefault();
    setError("");
    if (!title.trim()) {
      setError("Título obrigatório.");
      return;
    }
    if (!cityId) {
      setError("Cidade obrigatória.");
      return;
    }
    sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        title: title.trim(),
        details: details.trim(),
        cityId: Number(cityId),
      })
    );
    router.push("/pedir/preview");
  }

  return (
    <main className="page page-pedir">
      <section className="pedir-hero reveal">
        <div className="pedir-hero-copy">
          <p className="pedir-kicker">Novo pedido</p>
          <h1 className="pedir-title">
            Conta o que você procura —{" "}
            <span>a galera indica</span>
          </h1>
          <p className="pedir-lead">
            Um título claro e a cidade já bastam. Detalhes ajudam a receber
            indicações mais certeiras.
          </p>
          <ul className="pedir-tips" aria-label="Dicas rápidas">
            {TIPS.map((tip) => (
              <li key={tip} className="pedir-chip">
                {tip}
              </li>
            ))}
          </ul>
        </div>
        <div className="pedir-hero-art" aria-hidden>
          <div className="pedir-hero-panel">
            <Image
              src="/home/cta-pedir.png"
              alt=""
              width={240}
              height={240}
              className="pedir-hero-illustration"
              priority
              unoptimized
            />
          </div>
        </div>
      </section>

      <section className="pedir-card reveal delay-1">
        <header className="pedir-card-head">
          <h2>Monte seu pedido</h2>
          <p>Depois você confere na prévia antes de publicar.</p>
        </header>

        <form className="pedir-form" onSubmit={goPreview}>
          <label className="pedir-field">
            <span className="pedir-label">
              Título
              <span className="pedir-req">obrigatório</span>
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
              placeholder="Ex.: Dentista infantil perto do centro"
              autoComplete="off"
            />
            <span className="pedir-field-hint">
              {title.length}/200 · quanto mais específico, melhor
            </span>
          </label>

          <label className="pedir-field">
            <span className="pedir-label">
              Cidade
              <span className="pedir-req">obrigatório</span>
            </span>
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
            {me?.cityId ? (
              <span className="pedir-field-hint">
                Padrão: cidade do seu perfil
              </span>
            ) : null}
          </label>

          <label className="pedir-field">
            <span className="pedir-label">
              Detalhes
              <span className="pedir-opt">opcional</span>
            </span>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Bairro, orçamento, preferências, horário…"
            />
          </label>

          <div className="pedir-actions">
            <button className="pedir-submit" type="submit">
              Pré-visualizar
              <span className="btn-arrow" aria-hidden>
                →
              </span>
            </button>
          </div>
        </form>

        {error ? <p className="error-box">{error}</p> : null}
      </section>

      <p className="pedir-footer reveal delay-2">
        <Link href="/pedir/meus">Meus pedidos</Link>
        <span aria-hidden>·</span>
        <Link href="/">Home</Link>
      </p>
    </main>
  );
}
