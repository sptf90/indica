"use client";

import ReputationRingGauge from "@/components/ReputationRingGauge";
import {
  getReputationLevel,
  getReputationPercent,
  getReputationTraffic,
} from "@/lib/reputation-ui";

const SIZE = {
  hero: { box: 132, stroke: 9, font: "1.95rem" },
  metric: { box: 84, stroke: 7.2, font: "1.15rem" },
  profile: { box: 108, stroke: 8, font: "1.55rem" },
  compact: { box: 64, stroke: 6.2, font: "0.8rem" },
};

/**
 * Badge/anel circular de reputação — métrica visual hero.
 * size: hero | metric | profile | compact
 */
export default function ReputationBadge({
  reputation,
  hasEvaluations,
  selectedAndEvaluatedCount,
  reputationLabel,
  size = "hero",
  frozen = false,
  showTrust = true,
  showLabel = true,
  className = "",
}) {
  const level = getReputationLevel({
    reputation,
    hasEvaluations,
    selectedAndEvaluatedCount,
  });
  const pct = getReputationPercent({
    reputation,
    hasEvaluations,
    selectedAndEvaluatedCount,
  });
  const traffic = level.id === "none" ? null : getReputationTraffic(pct);
  const dim = SIZE[size] || SIZE.hero;
  const progress = level.id === "none" ? 0 : pct;
  const display = `${pct}%`;
  const ariaLabel =
    reputationLabel ||
    (level.id === "none"
      ? "Reputação 0/100 - Sem avaliações"
      : `Reputação ${pct}/100`);

  return (
    <div
      className={`rep-badge rep-badge--${size} rep-level-${level.id}${
        traffic ? ` rep-traffic-${traffic.id}` : ""
      }${frozen ? " is-frozen" : ""}${className ? ` ${className}` : ""}`}
      data-rep-traffic={traffic?.id || "none"}
      role="img"
      aria-label={ariaLabel}
    >
      <div className="rep-ring-wrap" style={{ width: dim.box, height: dim.box }}>
        <ReputationRingGauge
          percent={progress}
          size={dim.box}
          strokeWidth={dim.stroke}
          className={frozen ? "is-frozen" : ""}
        />
        <div className="rep-ring-core">
          <strong className="rep-value" style={{ fontSize: dim.font }}>
            {display}
          </strong>
          {size !== "compact" ? (
            <span className="rep-unit">reputação</span>
          ) : null}
        </div>
      </div>
      {(showLabel || showTrust) && size !== "compact" ? (
        <div className="rep-meta">
          {showLabel ? (
            <span className="rep-level-pill">{level.label}</span>
          ) : null}
          {showTrust ? <p className="rep-trust">{level.trust}</p> : null}
          {frozen ? (
            <p
              className="rep-frozen-note"
              title="Confiança que essa pessoa tinha quando a comparação abriu. O valor fica fixo nesta comparação."
            >
              quando a comparação abriu
            </p>
          ) : null}
        </div>
      ) : null}
      {size === "compact" && showTrust ? (
        <span className="rep-compact-trust">{level.trust}</span>
      ) : null}
    </div>
  );
}
