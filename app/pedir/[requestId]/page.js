"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import Countdown from "@/components/Countdown";
import ReputationBadge from "@/components/ReputationBadge";
import { api } from "@/lib/client-api";
import { INVALID_REASONS } from "@/lib/constants";

const REASONS = INVALID_REASONS;
const EDIT_BLOCKED_MSG =
  "Não é possível editar após a primeira indicação.";

function statusTone(status) {
  if (status === "open") return "ok";
  if (status === "in_evaluation") return "info";
  if (status === "completed") return "done";
  return "muted";
}

function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function mapsHref(place) {
  if (!place) return null;
  const url = place.mapsUrl || place.maps_url;
  if (url && typeof url === "string" && /^https?:\/\//i.test(url.trim())) {
    return url.trim();
  }
  return null;
}

function PedidoDetailPage() {
  const { requestId } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [request, setRequest] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [chosenIndications, setChosenIndications] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reasonCode, setReasonCode] = useState("");
  const [reasonText, setReasonText] = useState("");
  const [evalOutcome, setEvalOutcome] = useState("");
  const [evalBusy, setEvalBusy] = useState(false);
  const [roundExhausted, setRoundExhausted] = useState(false);
  const [canEdit, setCanEdit] = useState(false);

  const load = useCallback(async () => {
    const data = await api(`/api/requests/${requestId}`);
    setRequest(data.item);
    setChosenIndications(data.chosenIndications || []);
    if (data.item.comparisonOpenedAt) {
      const cmp = await api(`/api/requests/${requestId}/comparison`);
      setComparison(cmp);
      const remaining = (cmp.indications || []).filter(
        (i) => !i.hidden && i.result !== "invalid" && i.status !== "invalid"
      );
      const selected = data.item.selectedIndicationId;
      setRoundExhausted(
        data.item.status === "in_evaluation" &&
          !selected &&
          remaining.length === 0
      );
    } else {
      setComparison(null);
      setRoundExhausted(false);
    }
  }, [requestId]);

  useEffect(() => {
    load().catch((err) => {
      if (err.status === 401) router.push("/login");
      else setError(err.message);
    });
  }, [load, router]);

  useEffect(() => {
    if (request) {
      setCanEdit(
        typeof request.canEdit === "boolean"
          ? request.canEdit
          : request.status === "open" &&
              Number(request.participationCount || request.indicationCount || 0) === 0
      );
    }
  }, [request]);

  useEffect(() => {
    if (searchParams.get("aviso") !== "edicao-bloqueada") return;
    setMessage(EDIT_BLOCKED_MSG);
    router.replace(`/pedir/${requestId}`, { scroll: false });
  }, [searchParams, requestId, router]);

  async function openComparison() {
    setError("");
    try {
      await api(`/api/requests/${requestId}/open-comparison`, { method: "POST" });
      setMessage("Comparação aberta. Pedido em avaliação.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function selectIndication(indicationId) {
    setError("");
    try {
      await api(`/api/requests/${requestId}/select`, {
        method: "POST",
        body: JSON.stringify({ indicationId }),
      });
      setMessage("Escolha confirmada. Prazo de avaliação iniciado.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitEvaluation(e) {
    e?.preventDefault?.();
    if (!evalOutcome) {
      setError("Escolha se a indicação é válida ou não válida.");
      return;
    }
    if (evalOutcome === "invalid" && !reasonCode) {
      setError("Selecione o motivo para marcar como não válida.");
      return;
    }
    setError("");
    setEvalBusy(true);
    try {
      const payload =
        evalOutcome === "invalid"
          ? {
              outcome: "invalid",
              reasonCode,
              reasonText: reasonText.trim() || undefined,
            }
          : { outcome: "valid" };
      const result = await api(`/api/requests/${requestId}/evaluate`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (evalOutcome === "valid") {
        setMessage("Indicação válida. Pedido concluído.");
      } else {
        setMessage("Indicação marcada como não válida.");
        setRoundExhausted(Boolean(result.roundExhausted));
      }
      setReasonCode("");
      setReasonText("");
      setEvalOutcome("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setEvalBusy(false);
    }
  }

  async function reopen() {
    setError("");
    try {
      await api(`/api/requests/${requestId}/reopen`, { method: "POST" });
      setMessage("Pedido reaberto para novas indicações.");
      setRoundExhausted(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function close(mode) {
    setError("");
    try {
      await api(`/api/requests/${requestId}/close`, {
        method: "POST",
        body: JSON.stringify({ mode }),
      });
      setMessage("Pedido encerrado.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove() {
    if (!confirm("Excluir este pedido?")) return;
    setError("");
    try {
      await api(`/api/requests/${requestId}`, { method: "DELETE" });
      router.push("/pedir/meus");
    } catch (err) {
      setError(err.message);
    }
  }

  if (!request && !error) {
    return (
      <main className="page page-pedido">
        <p className="pedido-loading">Carregando…</p>
      </main>
    );
  }

  if (!request) {
    return (
      <main className="page page-pedido">
        <p className="error-box">{error}</p>
        <p className="pedido-crumb">
          <Link href="/pedir/meus">← Meus pedidos</Link>
        </p>
      </main>
    );
  }

  const selectedId = request.selectedIndicationId
    ? Number(request.selectedIndicationId)
    : null;
  const tone = statusTone(request.status);
  const hasComparison = Boolean(comparison);
  const cycleIndCount = Number(request.currentCycleIndicationCount || 0);
  const canOpenComparison = request.status === "open" && cycleIndCount > 0;
  const waitingNewIndications =
    request.status === "open" &&
    cycleIndCount === 0 &&
    Number(request.indicationCount || 0) > 0;
  const detailsText =
    typeof request.details === "string" ? request.details.trim() : "";

  return (
    <main className="page page-pedido">
      <nav className="pedido-crumb" aria-label="Navegação">
        <Link href="/pedir/meus">Meus pedidos</Link>
        <span aria-hidden>›</span>
        <span>Pedido</span>
      </nav>

      <header className="pedido-head">
        <p className="eyebrow">
          {hasComparison ? "Comparação" : "Meu pedido"}
        </p>
        <div className="pedido-title-row">
          <h1 className="pedido-title">{request.title}</h1>
          <span className={`status-badge ${tone === "done" ? "ok" : tone}`}>
            {request.statusLabel}
          </span>
        </div>
        <p className="pedido-meta">
          <span className="pedido-meta-icon" aria-hidden>
            <PinIcon />
          </span>
          {request.cityName} ({request.cityState})
        </p>
        <div className="pedido-details-block">
          <p className="pedido-details-label">Detalhes do pedido</p>
          {detailsText ? (
            <p className="pedido-details">{detailsText}</p>
          ) : (
            <p className="pedido-details pedido-details--empty">
              Sem detalhes adicionais.
            </p>
          )}
        </div>
        {request.evaluationDeadlineAt ? (
          <Countdown
            deadlineAt={request.evaluationDeadlineAt}
            serverNow={request.serverNow}
          />
        ) : null}
      </header>

      <div className="pedido-actions">
        {canOpenComparison ? (
          <button className="pedido-cta" type="button" onClick={openComparison}>
            Abrir comparação
          </button>
        ) : null}
        {canEdit ? (
          <Link className="pedido-cta-secondary" href={`/pedir/${requestId}/editar`}>
            Editar
          </Link>
        ) : null}
        {!request.comparisonOpenedAt ? (
          <button className="pedido-cta-ghost" type="button" onClick={remove}>
            Excluir
          </button>
        ) : null}
      </div>
      {!canEdit &&
      request.status === "open" &&
      Number(request.participationCount || request.indicationCount || 0) > 0 &&
      message !== EDIT_BLOCKED_MSG ? (
        <p className="pedido-edit-lock" role="note">
          Edição bloqueada após a primeira indicação
        </p>
      ) : null}

      {message === EDIT_BLOCKED_MSG ? (
        <p className="pedido-edit-lock" role="status">
          {message}
        </p>
      ) : message ? (
        <p className="ok-box">{message}</p>
      ) : null}
      {error ? <p className="error-box">{error}</p> : null}
      {waitingNewIndications ? (
        <p className="pedido-cycle-hint" role="status">
          Neste ciclo ainda não há indicações novas para comparar. Abaixo
          está o que você já escolheu e avaliou
          {request.reopenCount > 0
            ? ` (reabertura ${request.reopenCount}/3)`
            : ""}
          .
        </p>
      ) : null}

      {chosenIndications.length ? (
        <section
          className="pedido-chosen"
          aria-labelledby="chosen-heading"
          data-testid="pedido-chosen"
        >
          <div className="pedido-chosen-head">
            <h2 id="chosen-heading">Escolhas e avaliações</h2>
            <p className="pedido-cmp-lead">
              Indicações que você já escolheu, com o resultado da avaliação.
            </p>
          </div>
          <ul className="pedido-chosen-list">
            {chosenIndications.map((item) => {
              const maps = mapsHref(item.place);
              const outcomeClass =
                item.outcome === "valid"
                  ? "is-valid"
                  : item.outcome === "invalid"
                    ? "is-invalid"
                    : "is-pending";
              const outcomeLabel = item.outcomeLabel || "Em avaliação";
              const cycleLabel = `Ciclo ${Number(item.cycleNumber) + 1}`;
              return (
                <li key={item.id}>
                  <article
                    className={`chosen-card chosen-card--${outcomeClass}`}
                    data-outcome={item.outcome || "pending"}
                  >
                    <div className="chosen-card-top">
                      <span
                        className={`chosen-outcome ${outcomeClass}`}
                        data-outcome={item.outcome || "pending"}
                      >
                        {outcomeLabel}
                      </span>
                      <span className="chosen-cycle" aria-label={cycleLabel}>
                        {cycleLabel}
                      </span>
                    </div>
                    <h3 className="chosen-desc">{item.description}</h3>
                    {item.place ? (
                      <div className="cmp-place">
                        <span className="cmp-place-icon" aria-hidden>
                          <PinIcon />
                        </span>
                        <div className="cmp-place-body">
                          <p className="cmp-place-name">
                            {item.place.name}
                            {item.place.address ? (
                              <span className="cmp-place-addr">
                                {" "}
                                — {item.place.address}
                              </span>
                            ) : null}
                          </p>
                          {maps ? (
                            <a
                              className="cmp-maps-link"
                              href={maps}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Abrir no Maps
                              <span aria-hidden>↗</span>
                            </a>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    {item.links?.length ? (
                      <ul className="cmp-links">
                        {item.links.map((url) => (
                          <li key={url}>
                            <a href={url} target="_blank" rel="noreferrer">
                              {url}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="chosen-card-meta">
                      {item.outcome === "invalid" && item.reasonLabel ? (
                        <p className="chosen-reason">
                          <span className="chosen-meta-label">Motivo</span>{" "}
                          {item.reasonLabel}
                          {item.reasonText ? ` — ${item.reasonText}` : ""}
                        </p>
                      ) : null}
                      {item.recommender ? (
                        <p className="chosen-indicator perfil-context-link">
                          <span className="chosen-meta-label">Indicador</span>{" "}
                          <Link href={`/perfil/${item.recommender.username}`}>
                            {item.recommender.photoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.recommender.photoUrl}
                                alt=""
                                width={22}
                                height={22}
                                className="cmp-recommender-photo"
                              />
                            ) : null}
                            @{item.recommender.username}
                          </Link>
                        </p>
                      ) : null}
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {comparison ? (
        <section className="pedido-cmp" aria-labelledby="cmp-heading">
          <div className="pedido-cmp-head">
            <h2 id="cmp-heading">Indicações anónimas</h2>
            <p className="pedido-cmp-lead">
              Ordenadas por confiança e pelo número de indicações válidas que
              cada pessoa tinha quando a comparação abriu. Identidade oculta
              até confirmar a escolha.
            </p>
          </div>

          <div className="pedido-cmp-list">
            {(comparison.indications || []).map((item, index) => {
              if (item.hidden) {
                return (
                  <div key={item.id} className="cmp-card cmp-card--hidden">
                    Indicação indisponível enquanto outra está em teste.
                  </div>
                );
              }

              const maps = mapsHref(item.place);
              const isSelected = selectedId === Number(item.id);
              const canChoose =
                !selectedId &&
                request.status === "in_evaluation" &&
                item.result !== "invalid";
              const rep = item.reputation ?? 0;

              return (
                <article
                  key={item.id}
                  className={`cmp-card${isSelected ? " cmp-card--selected" : ""}`}
                >
                  <div className="cmp-card-top">
                    <span className="cmp-rank" aria-hidden>
                      #{index + 1}
                    </span>
                    {isSelected ? (
                      <span className="cmp-selected-pill">Escolhida</span>
                    ) : null}
                  </div>

                  <p className="cmp-desc">{item.description}</p>

                  {item.place ? (
                    <div className="cmp-place">
                      <span className="cmp-place-icon" aria-hidden>
                        <PinIcon />
                      </span>
                      <div className="cmp-place-body">
                        <p className="cmp-place-name">
                          {item.place.name}
                          {item.place.address ? (
                            <span className="cmp-place-addr">
                              {" "}
                              — {item.place.address}
                            </span>
                          ) : null}
                        </p>
                        {maps ? (
                          <a
                            className="cmp-maps-link"
                            href={maps}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Abrir no Maps
                            <span aria-hidden>↗</span>
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {item.links?.length ? (
                    <ul className="cmp-links">
                      {item.links.map((url) => (
                        <li key={url}>
                          <a href={url} target="_blank" rel="noreferrer">
                            {url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="cmp-trust">
                    <ReputationBadge
                      reputation={rep}
                      hasEvaluations
                      selectedAndEvaluatedCount={1}
                      reputationLabel={`Confiança ${rep}%`}
                      size="metric"
                      frozen
                      showLabel
                      showTrust
                    />
                    <div
                      className="cmp-validas"
                      aria-label="Indicações válidas no histórico, fixas desde a abertura da comparação"
                      title="Quantas indicações válidas essa pessoa já tinha no histórico quando a comparação abriu. O número fica fixo nesta comparação."
                    >
                      <span className="cmp-validas-label">
                        Indicações válidas
                      </span>
                      <strong className="cmp-validas-value">
                        {item.validIndicationCount ?? 0}
                      </strong>
                      <span className="cmp-validas-note">
                        quando a comparação abriu
                      </span>
                    </div>
                  </div>

                  {item.recommender ? (
                    <p className="cmp-recommender perfil-context-link">
                      Indicador:{" "}
                      <Link href={`/perfil/${item.recommender.username}`}>
                        {item.recommender.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.recommender.photoUrl}
                            alt=""
                            width={22}
                            height={22}
                            className="cmp-recommender-photo"
                          />
                        ) : null}
                        @{item.recommender.username}
                      </Link>
                    </p>
                  ) : null}

                  {item.result === "invalid" ? (
                    <p className="cmp-invalid">Avaliada como não válida.</p>
                  ) : null}

                  {canChoose ? (
                    <button
                      className="cmp-cta"
                      type="button"
                      onClick={() => selectIndication(item.id)}
                    >
                      Escolher esta
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {selectedId && request.status === "in_evaluation" ? (
        <section className="pedido-eval" aria-labelledby="eval-heading">
          <h2 id="eval-heading">Avaliar indicação escolhida</h2>
          <p className="pedido-eval-lead">
            A indicação funcionou? Escolha uma opção e confirme.
          </p>
          <form className="form pedido-eval-form" onSubmit={submitEvaluation}>
            <fieldset className="pedido-eval-choice">
              <legend className="pedido-eval-choice-label">Resultado</legend>
              <div
                className="pedido-eval-choice-row"
                role="radiogroup"
                aria-label="Resultado da avaliação"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={evalOutcome === "valid"}
                  className={`pedido-eval-option${
                    evalOutcome === "valid" ? " is-selected is-valid" : ""
                  }`}
                  onClick={() => {
                    setEvalOutcome("valid");
                    setReasonCode("");
                    setReasonText("");
                    setError("");
                  }}
                >
                  Válida
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={evalOutcome === "invalid"}
                  className={`pedido-eval-option${
                    evalOutcome === "invalid" ? " is-selected is-invalid" : ""
                  }`}
                  onClick={() => {
                    setEvalOutcome("invalid");
                    setError("");
                  }}
                >
                  Não válida
                </button>
              </div>
            </fieldset>

            {evalOutcome === "invalid" ? (
              <div className="pedido-eval-details">
                <label>
                  Motivo <span className="hint">(obrigatório)</span>
                  <select
                    value={reasonCode}
                    onChange={(e) => setReasonCode(e.target.value)}
                    required
                  >
                    <option value="">Selecione</option>
                    {REASONS.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Complemento <span className="hint">(opcional)</span>
                  <textarea
                    value={reasonText}
                    onChange={(e) => setReasonText(e.target.value)}
                    rows={3}
                    placeholder="Detalhe se quiser"
                  />
                </label>
              </div>
            ) : null}

            <div className="pedido-eval-submit">
              <button
                className="pedido-cta"
                type="submit"
                disabled={!evalOutcome || evalBusy}
              >
                {evalBusy ? "Confirmando…" : "Confirmar avaliação"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {roundExhausted ? (
        <section className="pedido-round" aria-labelledby="round-heading">
          <h2 id="round-heading">Rodada esgotada</h2>
          <p className="pedido-cmp-lead">
            Nenhuma indicação restante neste ciclo. Reaberturas usadas:{" "}
            {request.reopenCount}/3
          </p>
          <div className="pedido-actions">
            {request.reopenCount < 3 ? (
              <button className="pedido-cta" type="button" onClick={reopen}>
                Reabrir pedido
              </button>
            ) : (
              <button
                className="pedido-cta"
                type="button"
                onClick={() => close("no_valid")}
              >
                Encerrar — nenhuma indicação válida
              </button>
            )}
            {request.reopenCount < 3 ? (
              <button
                className="pedido-cta-ghost"
                type="button"
                onClick={() => close("voluntary")}
              >
                Encerrar sem solução
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {request.status === "closed_no_valid" ? (
        <p className="ok-box">
          Encerrado - nenhuma indicação válida.{" "}
          <Link href="/pedir">Criar novo pedido</Link>
        </p>
      ) : null}
    </main>
  );
}

export default function PedidoDetailPageSuspense() {
  return (
    <Suspense
      fallback={
        <main className="page page-pedido">
          <p className="pedido-loading">Carregando…</p>
        </main>
      }
    >
      <PedidoDetailPage />
    </Suspense>
  );
}
