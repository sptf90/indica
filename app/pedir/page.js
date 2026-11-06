"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ContactModePicker from "@/components/ContactModePicker";
import { validateContactMode } from "@/lib/indication-contact";
import IbgeCityPicker from "@/components/IbgeCityPicker";
import { api } from "@/lib/client-api";

const DRAFT_KEY = "indica_request_draft";

const TIPS = [
  "Seja específico",
  "Inclua bairro se ajudar",
  "Diga o que importa pra você",
];

export default function PedirPage() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [contactMode, setContactMode] = useState("");
  const [cityId, setCityId] = useState("");
  const [state, setState] = useState("");
  const [cityName, setCityName] = useState("");
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/auth/me")
      .then((meData) => {
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
            setContactMode(parsed.contactMode || "");
            setCityId(String(parsed.cityId || meData.user?.cityId || ""));
            setState(parsed.state || meData.user?.cityState || "");
            setCityName(parsed.cityName || meData.user?.cityName || "");
            return;
          } catch {
            // ignore
          }
        }
        setCityId(String(meData.user?.cityId || ""));
        setState(meData.user?.cityState || "");
        setCityName(meData.user?.cityName || "");
      })
      .catch((err) => {
        if (err.status === 401) router.push("/login");
        else setError(err.message);
      });
  }, [router]);

  async function onPlaceChange({ state: nextState, cityName: nextCity }) {
    setState(nextState);
    setCityName(nextCity);

    if (!nextState || !nextCity) {
      setCityId("");
      return;
    }

    setResolving(true);
    setError("");
    try {
      const data = await api("/api/cities/ensure", {
        method: "POST",
        body: JSON.stringify({ name: nextCity, state: nextState }),
      });
      setCityId(String(data.city.id));
    } catch (err) {
      if (err.status === 401) router.push("/login");
      else setError(err.message);
      setCityId("");
    } finally {
      setResolving(false);
    }
  }

  function goPreview(event) {
    event.preventDefault();
    setError("");
    try { validateContactMode(contactMode); } catch (err) { setError(err.message); return; }
    if (!title.trim()) {
      setError("Título obrigatório.");
      return;
    }
    if (!state || !cityName || !cityId) {
      setError("Selecione o estado e a cidade.");
      return;
    }
    if (resolving) {
      setError("Aguarde a cidade ser confirmada.");
      return;
    }
    sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        title: title.trim(),
        details: details.trim(),
        contactMode,
        cityId: Number(cityId),
        state,
        cityName,
        cityLabel: `${cityName} (${state})`,
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
            Conta o que você procura — <span>a galera indica</span>
          </h1>
          <p className="pedir-lead">
            Diga o que procura, a cidade e como quer receber a indicação. Detalhes ajudam a receber
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

          <div className="pedir-field">
            <span className="pedir-label">
              Local
              <span className="pedir-req">obrigatório</span>
            </span>
            <IbgeCityPicker
              layout="row"
              required
              state={state}
              cityName={cityName}
              onChange={onPlaceChange}
              disabled={resolving}
            />
            {me?.cityId ? (
              <span className="pedir-field-hint">
                Padrão: cidade do seu perfil
              </span>
            ) : (
              <span className="pedir-field-hint">
                Estado à esquerda, cidade à direita
              </span>
            )}
          </div>

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

          <ContactModePicker value={contactMode} onChange={setContactMode} disabled={resolving} />

          <div className="pedir-actions">
            <button
              className="pedir-submit"
              type="submit"
              disabled={resolving}
            >
              {resolving ? "Confirmando cidade…" : "Pré-visualizar"}
              {!resolving ? (
                <span className="btn-arrow" aria-hidden>
                  →
                </span>
              ) : null}
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
