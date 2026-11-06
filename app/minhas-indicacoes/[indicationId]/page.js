"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import LocationPicker from "@/components/LocationPicker";
import PlaceNavigationLinks from "@/components/PlaceNavigationLinks";
import IndicationContactFields from "@/components/IndicationContactFields";
import { validateIndicationContact } from "@/lib/indication-contact";
import ReputationBadge from "@/components/ReputationBadge";
import { api } from "@/lib/client-api";

function formatDelta(n) {
  const v = Number(n) || 0;
  if (v > 0) return `+${v}`;
  return String(v);
}

function reputationTone(delta) {
  const v = Number(delta) || 0;
  if (v > 0) return "up";
  if (v < 0) return "down";
  return "flat";
}

function reputationCopy(delta) {
  const v = Number(delta) || 0;
  if (v > 0) return "Sua reputação cresceu";
  if (v < 0) return "Sua reputação caiu";
  return "Sua reputação se manteve";
}

function OutcomePanel({ outcome }) {
  if (!outcome?.kind || outcome.kind === "pending") return null;

  const tone =
    outcome.kind === "chosen_valid"
      ? "win"
      : outcome.kind === "chosen_invalid"
        ? "lose"
        : outcome.kind === "not_chosen"
          ? "miss"
          : outcome.kind === "in_evaluation"
            ? "wait"
            : "muted";

  const rep = outcome.reputation;
  const showRep = Boolean(rep) && outcome.wasEvaluated;
  const points =
    outcome.pointsDelta != null && Number(outcome.pointsDelta) !== 0
      ? Number(outcome.pointsDelta)
      : null;

  return (
    <section
      className={`ind-outcome ind-outcome--${tone}`}
      data-tour="indicacao-outcome"
      data-outcome={outcome.kind}
      aria-live="polite"
    >
      <div className="ind-outcome-main">
        <p className="ind-outcome-kicker">
          {outcome.wasChosen
            ? outcome.kind === "in_evaluation"
              ? "Selecionada"
              : "Resultado"
            : "Resultado"}
        </p>
        <h2 className="ind-outcome-title">{outcome.title}</h2>
        {outcome.subtitle ? (
          <p className="ind-outcome-sub">{outcome.subtitle}</p>
        ) : null}
      </div>

      {showRep ? (
        <div
          className={`ind-outcome-rep ind-outcome-rep--${reputationTone(rep.delta)}`}
          data-tour="indicacao-reputacao"
        >
          <ReputationBadge
            reputation={rep.after}
            hasEvaluations
            selectedAndEvaluatedCount={1}
            reputationLabel={`Reputação ${rep.after}/100`}
            size="compact"
            showTrust={false}
            showLabel={false}
          />
          <div className="ind-outcome-rep-copy">
            <p className="ind-outcome-rep-label">{reputationCopy(rep.delta)}</p>
            <p className="ind-outcome-rep-delta" aria-label="Variação de reputação">
              <span className="ind-outcome-rep-before">{rep.before}</span>
              <span aria-hidden> → </span>
              <strong className="ind-outcome-rep-change">
                {formatDelta(rep.delta)}
              </strong>
              <span aria-hidden> → </span>
              <span className="ind-outcome-rep-after">{rep.after}</span>
              <span className="ind-outcome-rep-unit"> /100</span>
            </p>
            {points != null ? (
              <p className="ind-outcome-points">
                Pontos nos rankings:{" "}
                <strong>{formatDelta(points)}</strong>
              </p>
            ) : null}
            <Link className="ind-outcome-rep-link" href="/perfil/reputacao">
              Ver histórico de reputação
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default function MinhaIndicacaoDetailPage() {
  const { indicationId } = useParams();
  const router = useRouter();
  const [item, setItem] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState("");
  const [linksText, setLinksText] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const data = await api(`/api/indications/${indicationId}`);
    setItem(data.item);
    setDescription(data.item.description || "");
    setLinksText((data.item.links || []).join("\n"));
    setSelectedPlace(data.item.place || null);
    setWhatsappNumber(data.item.whatsappNumber || "");
  }

  useEffect(() => {
    Promise.resolve().then(load).catch((err) => {
      if (err.status === 401) router.push("/login");
      else setError(err.message);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicationId, router]);

  async function save() {
    setError("");
    setSaving(true);
    try {
      validateIndicationContact(item.contactMode, { place: selectedPlace, whatsappNumber });
      const links = linksText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const place = selectedPlace?.name?.trim() && selectedPlace?.address?.trim() ? selectedPlace : null;
      await api(`/api/indications/${indicationId}`, {
        method: "PATCH",
        body: JSON.stringify({ description, links, place, whatsappNumber }),
      });
      setEditing(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally { setSaving(false); }
  }

  async function remove() {
    if (!confirm("Excluir esta indicação? Você não poderá indicar de novo neste pedido.")) {
      return;
    }
    setError("");
    try {
      await api(`/api/indications/${indicationId}`, { method: "DELETE" });
      router.push("/minhas-indicacoes");
    } catch (err) {
      setError(err.message);
    }
  }

  if (!item && !error) {
    return (
      <main className="page page-indicacao-detail">
        <p className="muted">Carregando…</p>
      </main>
    );
  }

  if (!item) {
    return (
      <main className="page page-indicacao-detail">
        <p className="error-box">{error}</p>
        <Link href="/minhas-indicacoes">Voltar</Link>
      </main>
    );
  }

  const outcome = item.outcome;
  const showOutcome =
    outcome &&
    outcome.kind &&
    outcome.kind !== "pending" &&
    (item.requestStatus !== "open" ||
      outcome.wasChosen ||
      outcome.kind === "in_evaluation");

  return (
    <main className="page page-indicacao-detail">
      <header className="ind-detail-head">
        <p className="ind-detail-kicker">Minha indicação</p>
        <h1>{item.requestTitle}</h1>
        <p className="lead">
          {item.cityName} ({item.cityState}) · {item.statusLabel}
        </p>
        <p className="muted">
          Pedido: {item.requestStatusLabel}
          {" · "}Solicitante oculto
        </p>
      </header>

      {showOutcome ? <OutcomePanel outcome={outcome} /> : null}

      {!editing ? (
        <>
          <div className="preview-box ind-detail-preview">
            <p className="ind-detail-preview-label">Sua indicação</p>
            <p>{item.description}</p>
            {item.links?.length ? (
              <ul>
                {item.links.map((url) => (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noreferrer">
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
            {item.whatsappNumber ? <p><a href={`https://wa.me/${item.whatsappNumber}`} target="_blank" rel="noreferrer">WhatsApp: +{item.whatsappNumber}</a></p> : null}
            {item.place ? (
              <p className="row-meta">
                Local: {item.place.name} — {item.place.address}
              </p>
            ) : null}
            <PlaceNavigationLinks place={item.place} />
            {item.result === "invalid" || outcome?.kind === "chosen_invalid" ? (
              <p className="error-box">
                Não válida
                {item.invalidReasonCode || outcome?.invalidReasonCode
                  ? `: ${
                      outcome?.invalidReasonLabel ||
                      item.invalidReasonCode ||
                      outcome?.invalidReasonCode
                    }`
                  : ""}
                {item.invalidReasonText || outcome?.invalidReasonText
                  ? ` — ${item.invalidReasonText || outcome.invalidReasonText}`
                  : ""}
              </p>
            ) : null}
          </div>
          {item.canEdit ? (
            <div className="toolbar">
              <button className="cta secondary" type="button" onClick={() => setEditing(true)}>
                Editar
              </button>
              <button className="cta ghost" type="button" onClick={remove}>
                Excluir
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label>
            Descrição
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              maxLength={500}
              required
            />
          </label>
          <label>
            Links (um por linha)
            <textarea value={linksText} onChange={(e) => setLinksText(e.target.value)} />
          </label>
          <IndicationContactFields mode={item.contactMode} whatsappNumber={whatsappNumber}
            onWhatsappChange={setWhatsappNumber} place={selectedPlace} onPlaceChange={setSelectedPlace}
            cityName={item.cityName} cityState={item.cityState} />
          {!item.contactMode ? <LocationPicker value={selectedPlace} onChange={setSelectedPlace}
            cityName={item.cityName} cityState={item.cityState} required={false} /> : null}
          <div className="toolbar">
            <button className="cta" type="submit" disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </button>
            <button className="cta ghost" type="button" onClick={() => setEditing(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {error ? <p className="error-box">{error}</p> : null}
      <p className="auth-note">
        <Link href="/minhas-indicacoes">Voltar</Link>
      </p>
    </main>
  );
}
