"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client-api";
import { SPONSOR_BANNER_UPLOAD } from "@/lib/sponsor-banner";

function formatPeriodLabel(start, end, modality) {
  const s = start ? new Date(start) : null;
  if (!s || Number.isNaN(s.getTime())) return "";
  if (modality === "monthly") {
    const month = s.toLocaleDateString("pt-BR", {
      month: "long",
      timeZone: "UTC",
    });
    const year = s.getUTCFullYear();
    const capped = month.charAt(0).toUpperCase() + month.slice(1);
    return `${capped} ${year}`;
  }
  const e = end ? new Date(end) : null;
  const opts = { day: "2-digit", month: "short", timeZone: "UTC" };
  const left = s.toLocaleDateString("pt-BR", opts);
  if (!e || Number.isNaN(e.getTime())) return left;
  const rightDate = new Date(e.getTime() - 1000);
  return `${left} – ${rightDate.toLocaleDateString("pt-BR", opts)}`;
}

function daysRemaining(periodEnd) {
  const end = periodEnd ? new Date(periodEnd) : null;
  if (!end || Number.isNaN(end.getTime())) return null;
  const now = Date.now();
  const ms = end.getTime() - now;
  if (ms <= 0) return 0;
  return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

function Avatar({ username, photoUrl, size = 36, className = "" }) {
  if (photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt=""
        width={size}
        height={size}
        className={`standing-avatar ${className}`.trim()}
        unoptimized
      />
    );
  }
  const initial = (username || "?").slice(0, 1).toUpperCase();
  return (
    <span
      className={`standing-avatar standing-avatar-fallback ${className}`.trim()}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initial}
    </span>
  );
}

function MetaIcon({ name }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };
  if (name === "calendar") {
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18" />
        <path d="M8 3v4" />
        <path d="M16 3v4" />
      </svg>
    );
  }
  if (name === "clock") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="3" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a3 3 0 0 1 0 5.74" />
    </svg>
  );
}

const BANNER_FULL = "/rankings/sponsor-banner-full.jpg";
const SPONSOR_PRODUCT = "/rankings/sponsor-product.jpg";

function SponsorHero({ ranking }) {
  const name = ranking.sponsored
    ? ranking.sponsorName
    : "Parceiro GoIndica";
  const bannerSrc = ranking.sponsorBannerUrl || BANNER_FULL;
  const alt = ranking.sponsored
    ? `Ranking ${ranking.modality === "weekly" ? "semanal" : "mensal"} patrocinado por ${name}`
    : "Espaço de patrocínio GoIndica";

  return (
    <section
      className={`rm-sponsor-hero${ranking.sponsored ? " is-real" : " is-placeholder"}`}
      aria-label={alt}
      data-banner-upload={`${SPONSOR_BANNER_UPLOAD.width}x${SPONSOR_BANNER_UPLOAD.height}`}
      data-banner-ratio={SPONSOR_BANNER_UPLOAD.ratio}
      style={{ "--rm-banner-ratio": `${SPONSOR_BANNER_UPLOAD.ratioNumber} / 1` }}
    >
      <Image
        src={bannerSrc}
        alt={alt}
        fill
        priority
        className="rm-sponsor-hero-img"
        sizes="(max-width: 720px) 100vw, min(84rem, 100vw)"
        unoptimized
      />
      <p className="rm-banner-crumb">
        <Link href="/rankings">← Rankings</Link>
      </p>
    </section>
  );
}

function CrownIcon() {
  return (
    <svg
      className="rm-podium-crown-svg"
      width="28"
      height="22"
      viewBox="0 0 28 22"
      aria-hidden
    >
      <path
        d="M3 17.5 5.5 7l4.2 5.2L14 3.5l4.3 8.7L22.5 7 25 17.5H3Z"
        fill="#E6B422"
        stroke="#C99212"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <rect x="3" y="17" width="22" height="3.2" rx="1" fill="#D4A017" />
    </svg>
  );
}

function Podium({ top3, highlightsLabel }) {
  if (!top3.length) return null;
  const first = top3.find((r) => r.position === 1) || top3[0];
  const second = top3.find((r) => r.position === 2);
  const third = top3.find((r) => r.position === 3);
  const slots = [
    { place: 2, row: second, className: "second" },
    { place: 1, row: first, className: "first" },
    { place: 3, row: third, className: "third" },
  ];

  return (
    <section className="rm-podium-card" aria-label={highlightsLabel}>
      <h2>{highlightsLabel}</h2>
      <ol className="rm-podium">
        {slots.map(({ place, row, className }) => {
          if (!row) {
            return (
              <li key={place} className={`rm-podium-slot ${className} empty`}>
                <div className="rm-podium-figure">
                  <span className={`rm-podium-badge place-${place}`}>
                    {place}º
                  </span>
                  <span className="muted">—</span>
                </div>
                <div className={`rm-podium-plinth place-${place}`} />
              </li>
            );
          }
          return (
            <li key={row.userId} className={`rm-podium-slot ${className}`}>
              <div className="rm-podium-figure">
                {place === 1 ? (
                  <CrownIcon />
                ) : (
                  <span className={`rm-podium-badge place-${place}`}>
                    {place}º
                  </span>
                )}
                <span className="rm-podium-who" aria-hidden="false">
                  <span
                    className={`rm-podium-avatar-wrap${
                      place === 1 ? " is-gold" : ""
                    }`}
                  >
                    <Avatar
                      username={row.username}
                      photoUrl={row.photoUrl}
                      size={place === 1 ? 78 : 54}
                      className={place === 1 ? "podium-lg" : "podium-md"}
                    />
                  </span>
                  <span className="rm-podium-name">{row.username}</span>
                </span>
                <span className="rm-podium-pts">
                  {row.points.toLocaleString("pt-BR")} pontos
                </span>
              </div>
              <div className={`rm-podium-plinth place-${place}`} aria-hidden />
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function MyPositionCard({ me, enrolled, busy, onEnroll, canEnroll, status }) {
  if (!enrolled && !me) {
    const isArchive = status === "final" || status === "tallying";
    return (
      <aside className="rm-side-card rm-my-pos">
        <h2>Minha posição</h2>
        {canEnroll ? (
          <>
            <p className="rm-side-lead">
              Inscreva-se para entrar na classificação deste período.
            </p>
            <button
              type="button"
              className="btn-solid rm-side-cta"
              disabled={busy}
              onClick={onEnroll}
            >
              {busy ? "Inscrevendo…" : "Inscrever-se"}
            </button>
          </>
        ) : (
          <p className="rm-side-lead">
            {isArchive
              ? "Você não participou deste ranking. A classificação final continua pública no arquivo."
              : "Inscrições indisponíveis neste momento."}
          </p>
        )}
      </aside>
    );
  }

  const place = me?.position ? `${me.position}º` : "—";
  const points = me?.points ?? 0;
  const confirms = me?.validCount ?? 0;

  return (
    <aside className="rm-side-card rm-my-pos">
      <h2>Minha posição</h2>
      <div className="rm-my-place-ring" aria-label={`${place} lugar`}>
        <strong>{place}</strong>
        <span>lugar</span>
      </div>
      <div className="rm-my-stats">
        <div>
          <strong>{points.toLocaleString("pt-BR")}</strong>
          <span>pontos</span>
        </div>
        <div className="rm-my-stats-divider" aria-hidden />
        <div>
          <strong>{confirms}</strong>
          <span>
            {confirms === 1
              ? "indicação confirmada"
              : "indicações confirmadas"}
          </span>
        </div>
      </div>
    </aside>
  );
}

function SponsorSupportCard({ ranking }) {
  if (!ranking.sponsored) {
    return (
      <aside className="rm-side-card rm-sponsor-support is-placeholder">
        <h2>Este ranking pode ter o apoio de uma marca</h2>
        <p>
          Quando houver patrocinador aprovado, a marca aparece aqui com a
          identificação “Patrocinado por”.
        </p>
        <div className="rm-sponsor-support-visual" aria-hidden>
          <div className="rm-sponsor-product-ph" />
          <span className="rm-sponsor-wordmark">GoIndica</span>
        </div>
      </aside>
    );
  }

  const name = ranking.sponsorName;
  const productSrc = ranking.sponsorProductUrl || SPONSOR_PRODUCT;
  return (
    <aside className="rm-side-card rm-sponsor-support">
      <h2>Este ranking tem o apoio de {name}</h2>
      <p>
        A marca apoia o reconhecimento de quem ajuda a comunidade com
        indicações confirmadas neste período.
      </p>
      <div className="rm-sponsor-support-visual">
        <Image
          src={productSrc}
          alt=""
          width={120}
          height={90}
          className="rm-sponsor-support-product"
          unoptimized
        />
        {ranking.sponsorLogoUrl ? (
          <Image
            src={ranking.sponsorLogoUrl}
            alt=""
            width={100}
            height={36}
            className="rm-sponsor-support-logo"
            unoptimized
          />
        ) : (
          <span className="rm-sponsor-wordmark">{name}</span>
        )}
      </div>
      <span className="rm-sponsor-cta" role="text">
        Conhecer {name}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
        >
          <path
            d="M14 4h6v6"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <path
            d="M10 14 20 4"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <path
            d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      </span>
    </aside>
  );
}

export default function RankingDetailPage() {
  const router = useRouter();
  const params = useParams();
  const rankingId = params?.id;
  const [ranking, setRanking] = useState(null);
  const [standings, setStandings] = useState([]);
  const [me, setMe] = useState(null);
  const [prize, setPrize] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState("");

  const load = useCallback(async () => {
    const data = await api(`/api/rankings/${rankingId}`);
    setRanking(data.ranking);
    setStandings(data.standings || []);
    setMe(data.me || null);
    setPrize(data.prize || data.ranking?.prize || null);
  }, [rankingId]);

  useEffect(() => {
    if (!rankingId) return;
    let cancelled = false;
    load().catch((err) => {
      if (cancelled) return;
      if (err.status === 401) router.replace("/login");
      else setError(err.message || "Falha ao carregar.");
    });
    return () => {
      cancelled = true;
    };
  }, [load, rankingId, router]);

  async function enroll() {
    setBusy(true);
    setError("");
    try {
      const res = await api(`/api/rankings/${rankingId}/enroll`, {
        method: "POST",
      });
      setFlash(res.message || "Inscrição confirmada.");
      await load();
    } catch (err) {
      setError(err.message || "Não foi possível se inscrever.");
    } finally {
      setBusy(false);
    }
  }

  const top3 = useMemo(
    () => standings.filter((r) => r.position >= 1 && r.position <= 3),
    [standings]
  );

  const tableRows = useMemo(() => {
    const rest = standings.filter((r) => r.position > 3);
    const head = rest.slice(0, 6);
    if (!me || me.position == null || me.position <= 3) return head;
    if (head.some((r) => r.userId === me.userId)) return head;
    const myRow = standings.find((r) => r.userId === me.userId);
    return myRow ? [...head, myRow] : head;
  }, [standings, me]);

  if (!ranking && !error) {
    return (
      <main className="page page-rankings page-ranking-mensal">
        <p className="muted">Carregando…</p>
      </main>
    );
  }

  if (!ranking) {
    return (
      <main className="page page-rankings page-ranking-mensal">
        <p className="error-box">{error}</p>
        <Link href="/rankings" className="btn-outline sm">
          Voltar
        </Link>
      </main>
    );
  }

  const isWeekly = ranking.modality === "weekly";
  const highlightsLabel = isWeekly ? "Destaques da semana" : "Destaques do mês";
  const pointsColLabel = isWeekly ? "Pontos na semana" : "Pontos no mês";
  const provisional =
    me?.provisionalMessage || prize?.provisionalMessage || null;
  const showFinalBenefit =
    ranking.status === "final" &&
    me?.inPrizeBand &&
    (me?.prizeBenefit || me?.redemptionInstructions);
  const remaining = daysRemaining(ranking.periodEnd);
  const participants =
    ranking.participantsCount != null
      ? ranking.participantsCount
      : standings.length;
  const periodLabel = formatPeriodLabel(
    ranking.periodStart,
    ranking.periodEnd,
    ranking.modality
  );
  const hasPrizes =
    Array.isArray(ranking.prizePositions) &&
    ranking.prizePositions.length > 0;
  const statusBadge =
    ranking.status === "open"
      ? { label: "Ativo", tone: "ok" }
      : ranking.status === "tallying"
        ? { label: "Em apuração", tone: "warn" }
        : ranking.status === "final" && hasPrizes
          ? { label: "Aguardando prêmios", tone: "info" }
          : ranking.status === "final"
            ? { label: "Finalizado", tone: "done" }
            : {
                label: ranking.statusLabel || ranking.status,
                tone: "muted",
              };

  return (
    <main className="page page-rankings page-ranking-mensal">
      <div className="rm-layout">
        <div className="rm-main">
          <SponsorHero ranking={ranking} />

          <div className="rm-meta-bar" role="list">
            <div className="rm-meta-item" role="listitem">
              <span
                className={`ranking-status-badge ranking-status-badge--${statusBadge.tone}`}
              >
                {statusBadge.label}
              </span>
            </div>
            <div className="rm-meta-item" role="listitem">
              <MetaIcon name="calendar" />
              <span>{periodLabel}</span>
            </div>
            <div className="rm-meta-item" role="listitem">
              <MetaIcon name="clock" />
              <span>
                {ranking.status === "final"
                  ? "Período encerrado"
                  : remaining == null
                    ? "—"
                    : remaining === 0
                      ? "Encerra hoje"
                      : `Faltam ${remaining} ${remaining === 1 ? "dia" : "dias"}`}
              </span>
            </div>
            <div className="rm-meta-item" role="listitem">
              <MetaIcon name="people" />
              <span>
                {participants}{" "}
                {participants === 1 ? "participante" : "participantes"}
              </span>
            </div>
          </div>

          {provisional && ranking.status !== "final" ? (
            <p
              className={`ranking-prize-msg${
                me?.inPrizeBand ? " in-band" : " out-band"
              }`}
            >
              {provisional}
              <span className="ranking-prize-disclaimer">
                Mensagem provisória — não garante o benefício.
              </span>
            </p>
          ) : null}

          {showFinalBenefit ? (
            <section className="ranking-benefit-panel" aria-label="Seu benefício">
              <h2>Seu benefício</h2>
              {me.prizeBenefit ? <p>{me.prizeBenefit}</p> : null}
              {me.redemptionInstructions ? (
                <p className="ranking-benefit-howto">
                  {me.redemptionInstructions}
                </p>
              ) : null}
            </section>
          ) : null}

          {flash ? <p className="ok-box">{flash}</p> : null}
          {error ? <p className="error-box">{error}</p> : null}

          <Podium top3={top3} highlightsLabel={highlightsLabel} />

          <section className="rm-table-card" aria-label="Classificação geral">
            <div className="rm-table-head">
              <h2>Classificação geral</h2>
              <p className="muted">
                Nome e foto informativos (não clicáveis).
                {ranking.prizePositions?.length
                  ? " Posições premiadas em destaque."
                  : ""}{" "}
                Empate: acessos pelo link → reputação.
              </p>
            </div>

            {standings.length === 0 ? (
              <p className="muted">Ainda sem inscritos.</p>
            ) : tableRows.length === 0 && top3.length > 0 ? (
              <p className="muted">
                A classificação geral completa os destaques acima.
              </p>
            ) : (
              <div className="rm-table-wrap">
                <table className="rm-table">
                  <thead>
                    <tr>
                      <th scope="col">Posição</th>
                      <th scope="col">Participante</th>
                      <th
                        scope="col"
                        title="Desempate: acessos distintos pelo link de partilha"
                      >
                        {pointsColLabel}
                      </th>
                      <th scope="col">Indicações confirmadas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row) => {
                      const isMe = me && row.userId === me.userId;
                      const tieTitle =
                        row.shareVisitCount != null
                          ? `Acessos pelo link: ${row.shareVisitCount}`
                          : undefined;
                      return (
                        <tr
                          key={row.userId}
                          className={`${isMe ? "is-me" : ""}${
                            row.isPrizePosition ? " is-prize" : ""
                          }`.trim()}
                          title={tieTitle}
                          data-share-visits={row.shareVisitCount ?? 0}
                        >
                          <td className="rm-col-pos">
                            {row.isPrizePosition ? (
                              <span
                                className="standing-prize-mark"
                                title="Premiada"
                              >
                                ★
                              </span>
                            ) : null}
                            {row.position}º
                          </td>
                          <td>
                            <span className="standing-who">
                              <Avatar
                                username={row.username}
                                photoUrl={row.photoUrl}
                                size={32}
                              />
                              <span className="standing-name">
                                {row.username}
                              </span>
                            </span>
                          </td>
                          <td className="rm-col-num">
                            {row.points.toLocaleString("pt-BR")}
                          </td>
                          <td className="rm-col-num">{row.validCount}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="rm-sidebar">
          <MyPositionCard
            me={me}
            enrolled={ranking.enrolled || Boolean(me)}
            busy={busy}
            onEnroll={enroll}
            canEnroll={ranking.acceptsEnrollment === true}
            status={ranking.effectiveStatus || ranking.status}
          />
          <SponsorSupportCard ranking={ranking} />
        </aside>
      </div>
    </main>
  );
}
