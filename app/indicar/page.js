"use client";

import MobileHelp from "@/components/MobileHelp";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import IbgeCityPicker from "@/components/IbgeCityPicker";
import RequestPhoto from "@/components/RequestPhoto";
import { api } from "@/lib/client-api";

const TIPS = [
  "Pedidos abertos na cidade",
  "Troca de cidade é só filtro",
  "Indique com confiança",
];

function statusTone(status) {
  if (status === "open") return "ok";
  if (status === "in_evaluation") return "info";
  return "muted";
}

function formatWhen(value) {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
    }).format(new Date(value));
  } catch {
    return null;
  }
}

export default function IndicarListaPage() {
  const router = useRouter();
  const [cityId, setCityId] = useState("");
  const [state, setState] = useState("");
  const [cityName, setCityName] = useState("");
  const [items, setItems] = useState([]);
  const [emptyMessage, setEmptyMessage] = useState("");
  const [nextCursor, setNextCursor] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [booting, setBooting] = useState(true);
  const [showHidden, setShowHidden] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  async function load(cid, cursor = null, append = false, hidden = showHidden) {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ cityId: String(cid) });
      if (cursor) qs.set("cursor", String(cursor));
      if (hidden) qs.set("scope", "hidden");
      const data = await api(`/api/indications?${qs.toString()}`);
      setItems((prev) =>
        append ? [...prev, ...(data.items || [])] : data.items || []
      );
      setNextCursor(data.nextCursor);
      setEmptyMessage(data.emptyMessage || "");
    } catch (err) {
      if (err.status === 401) router.push("/login");
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function changeVisibilityFilter(hidden) {
    if (hidden === showHidden) return;
    setShowHidden(hidden);
    setItems([]);
    setNextCursor(null);
    setEmptyMessage("");
    if (cityId) void load(cityId, null, false, hidden);
  }

  async function updateVisibility(id) {
    setUpdatingId(id);
    setError("");
    try {
      await api(`/api/indications/eligible/${id}/hidden`, { method: showHidden ? "DELETE" : "PUT" });
      setItems(previous => previous.filter(item => item.id !== id));
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  useEffect(() => {
    api("/api/auth/me")
      .then((me) => {
        const cid = me.user?.cityId != null ? String(me.user.cityId) : "";
        const uf = me.user?.cityState || "";
        const name = me.user?.cityName || "";
        setCityId(cid);
        setState(uf);
        setCityName(name);
        if (cid) return load(cid);
      })
      .catch((err) => {
        if (err.status === 401) router.push("/login");
        else setError(err.message);
      })
      .finally(() => setBooting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function onPlaceChange({ state: nextState, cityName: nextCity }) {
    setState(nextState);
    setCityName(nextCity);

    if (!nextState || !nextCity) {
      setCityId("");
      setItems([]);
      setNextCursor(null);
      setEmptyMessage("");
      return;
    }

    setResolving(true);
    setError("");
    try {
      const data = await api("/api/cities/ensure", {
        method: "POST",
        body: JSON.stringify({ name: nextCity, state: nextState }),
      });
      const cid = String(data.city.id);
      setCityId(cid);
      await load(cid);
    } catch (err) {
      if (err.status === 401) router.push("/login");
      else setError(err.message);
      setCityId("");
      setItems([]);
    } finally {
      setResolving(false);
    }
  }

  const showEmpty =
    !loading && !booting && !resolving && cityId && items.length === 0;
  const selectedLabel =
    cityName && state ? `${cityName} (${state})` : cityName || "";

  return (
    <main className="page page-indicar">
      <section className="indicar-hero reveal">
        <div className="indicar-hero-copy">
          <p className="indicar-kicker">Fazer uma indicação</p>
          <MobileHelp
            className="indicar-lead" label="Como encontrar pedidos para indicar"
            heading={
              <h1 className="indicar-title">
                Tem pedido aberto? <span>indica aí</span>
              </h1>
            }
          >
            Escolha a cidade, veja o que a galera procura e manda sua dica.
            Trocar o filtro não altera seu perfil.
          </MobileHelp>
          <ul className="indicar-tips" aria-label="Dicas rápidas">
            {TIPS.map((tip) => (
              <li key={tip} className="indicar-chip">
                {tip}
              </li>
            ))}
          </ul>
        </div>
        <div className="indicar-hero-art" aria-hidden>
          <div className="indicar-hero-panel">
            <Image
              src="/home/cta-fazer.png"
              alt=""
              width={240}
              height={240}
              className="indicar-hero-illustration"
              priority
              unoptimized
            />
          </div>
        </div>
      </section>

      <section className="indicar-filter reveal delay-1">
        <div className="indicar-filter-copy">
          <h2>Onde você quer indicar?</h2>
          <p>Pedidos abertos na cidade selecionada.</p>
        </div>
        <div className="indicar-city-field">
          <span className="indicar-label">
            Local
            <span className="indicar-req">filtro</span>
          </span>
          <IbgeCityPicker
            layout="row"
            required={false}
            state={state}
            cityName={cityName}
            onChange={onPlaceChange}
            disabled={booting || resolving || loading || updatingId !== null}
          />
          {selectedLabel ? (
            <span className="indicar-field-hint">
              {resolving
                ? "Atualizando lista…"
                : `Mostrando pedidos em ${selectedLabel}`}
            </span>
          ) : (
            <span className="indicar-field-hint">
              Escolha estado e cidade para listar pedidos
            </span>
          )}
        </div>
      </section>

      {error ? <p className="error-box">{error}</p> : null}

      <div className="request-visibility-filter" role="group" aria-label="Filtrar pedidos por visibilidade">
        <button type="button" aria-pressed={!showHidden}
          disabled={booting || loading || resolving || updatingId !== null}
          onClick={() => changeVisibilityFilter(false)}>Disponíveis</button>
        <button type="button" aria-pressed={showHidden}
          disabled={booting || loading || resolving || updatingId !== null}
          onClick={() => changeVisibilityFilter(true)}>Ocultados</button>
      </div>

      <section className="indicar-list reveal delay-2" aria-live="polite">
        {(loading || resolving) && items.length === 0 ? (
          <p className="indicar-loading">Carregando pedidos…</p>
        ) : null}

        {items.length > 0 ? (
          <ul className="indicar-cards">
            {items.map((item) => {
              const when = formatWhen(item.createdAt);
              return (
                <li key={item.id}>
                  <article className="indicar-card">
                    <div className="indicar-card-top">
                      <span
                        className={`indicar-status indicar-status--${statusTone(item.status)}`}
                      >
                        {item.statusLabel}
                      </span>
                      {when ? (
                        <span className="indicar-when">{when}</span>
                      ) : null}
                    </div>
                    <h3 className="indicar-card-title">
                      {showHidden ? item.title : <Link href={`/indicar/${item.id}/nova`}>{item.title}</Link>}
                    </h3>
                    <RequestPhoto src={item.photoUrl} thumbnail />
                    <div className="indicar-card-meta">
                      <span className="indicar-location" aria-label="Local">
                        <svg
                          viewBox="0 0 24 24"
                          width="14"
                          height="14"
                          aria-hidden
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" />
                          <circle cx="12" cy="10" r="2.5" />
                        </svg>
                        {item.cityName} ({item.cityState})
                      </span>
                      <div className="request-visibility-actions">
                        <button type="button" className="request-visibility-button"
                          disabled={loading || updatingId !== null} onClick={() => updateVisibility(item.id)}>
                          {updatingId === item.id ? "Salvando…" : showHidden ? "Restaurar pedido" : "Não quero indicar"}
                        </button>
                        {!showHidden && <Link className="indicar-card-cta" href={`/indicar/${item.id}/nova`}>Indicar →</Link>}
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        ) : null}

        {showEmpty ? (
          <div className="indicar-empty">
            <div className="indicar-empty-art" aria-hidden>
              <Image
                src="/home/cta-fazer.png"
                alt=""
                width={120}
                height={120}
                className="indicar-empty-illustration"
                unoptimized
              />
            </div>
            <h2>Nada por aqui agora</h2>
            <p>{emptyMessage || (showHidden ? "Você não tem pedidos ocultados nesta cidade." : "Não há pedidos disponíveis no momento.")}</p>
            {!showHidden && <>
            <p className="indicar-empty-hint">
              Troque a cidade ou volte mais tarde — novos pedidos aparecem aqui.
            </p>
            <Link className="indicar-empty-link" href="/pedir">
              Pedir uma indicação
              <span aria-hidden>→</span>
            </Link>
            </>}
          </div>
        ) : null}

        {!cityId && !booting && !loading && !resolving ? (
          <div className="indicar-empty indicar-empty--soft">
            <h2>Selecione estado e cidade</h2>
            <p>O filtro acima libera a lista de pedidos elegíveis.</p>
          </div>
        ) : null}

        {nextCursor ? (
          <button
            className="indicar-more"
            type="button"
            disabled={loading || resolving || updatingId !== null}
            onClick={() => load(cityId, nextCursor, true)}
          >
            {loading ? "Carregando…" : "Carregar mais"}
          </button>
        ) : null}
      </section>

      <p className="indicar-footer reveal delay-3">
        <Link href="/minhas-indicacoes">Minhas indicações</Link>
        <span aria-hidden>·</span>
        <Link href="/">Home</Link>
      </p>
    </main>
  );
}
