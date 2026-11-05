"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import IbgeCityPicker from "@/components/IbgeCityPicker";
import { api } from "@/lib/client-api";

export default function EditarPedidoPage() {
  const { requestId } = useParams();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [cityId, setCityId] = useState("");
  const [state, setState] = useState("");
  const [cityName, setCityName] = useState("");
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api(`/api/requests/${requestId}`)
      .then((req) => {
        if (cancelled) return;
        const item = req.item;
        const allowed =
          typeof item.canEdit === "boolean"
            ? item.canEdit
            : item.status === "open" &&
              Number(item.participationCount || item.indicationCount || 0) === 0;
        if (!allowed) {
          router.replace(`/pedir/${requestId}?aviso=edicao-bloqueada`);
          return;
        }
        setTitle(item.title || "");
        setDetails(item.details || "");
        setCityId(String(item.cityId || ""));
        setState(item.cityState || "");
        setCityName(item.cityName || "");
        setReady(true);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) router.push("/login");
        else setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [requestId, router]);

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

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    if (!state || !cityName || !cityId) {
      setError("Selecione o estado e a cidade.");
      return;
    }
    if (resolving) {
      setError("Aguarde a cidade ser confirmada.");
      return;
    }
    setLoading(true);
    try {
      await api(`/api/requests/${requestId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title,
          details,
          cityId: Number(cityId),
        }),
      });
      router.push(`/pedir/${requestId}`);
    } catch (err) {
      if (
        err.message &&
        /editar após a primeira indicação|Só é possível editar/i.test(
          err.message
        )
      ) {
        router.replace(`/pedir/${requestId}?aviso=edicao-bloqueada`);
        return;
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!ready && !error) {
    return (
      <main className="page">
        <h1>Editar pedido</h1>
        <p className="lead">Verificando se a edição ainda é permitida…</p>
      </main>
    );
  }

  if (error && !ready) {
    return (
      <main className="page">
        <h1>Editar pedido</h1>
        <p className="error-box">{error}</p>
        <p className="auth-note">
          <Link href={`/pedir/${requestId}`}>Voltar</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="page">
      <h1>Editar pedido</h1>
      <p className="lead">Só é possível editar antes da primeira indicação.</p>
      <form className="form" onSubmit={onSubmit}>
        <label>
          Título
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            required
          />
        </label>
        <div>
          <IbgeCityPicker
            layout="row"
            required
            state={state}
            cityName={cityName}
            onChange={onPlaceChange}
            disabled={resolving || loading}
          />
        </div>
        <label>
          Detalhes
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
        </label>
        <button className="cta" type="submit" disabled={loading || resolving}>
          {loading ? "Salvando…" : resolving ? "Confirmando cidade…" : "Salvar"}
        </button>
      </form>
      {error ? <p className="error-box">{error}</p> : null}
      <p className="auth-note">
        <Link href={`/pedir/${requestId}`}>Cancelar</Link>
      </p>
    </main>
  );
}
