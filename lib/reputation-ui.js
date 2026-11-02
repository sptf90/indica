/**
 * Helpers de apresentação da reputação (UI only).
 * Não altera a fórmula em lib/reputation.js.
 *
 * Semáforo (stroke + número):
 *   < 40  → vermelho (baixo)
 *   40–69 → amarelo (médio)
 *   ≥ 70  → verde (alto)
 */

export const REPUTATION_TRAFFIC = {
  red: {
    id: "red",
    label: "Baixa",
    min: 0,
    maxExclusive: 40,
    color: "#dc2626",
    soft: "#fee2e2",
  },
  yellow: {
    id: "yellow",
    label: "Média",
    min: 40,
    maxExclusive: 70,
    color: "#ca8a04",
    soft: "#fef9c3",
  },
  green: {
    id: "green",
    label: "Alta",
    min: 70,
    maxExclusive: 101,
    color: "#16a34a",
    soft: "#dcfce7",
  },
};

/**
 * Faixa de semáforo a partir do percentual 0–100.
 * @param {number|null|undefined} pct
 */
export function getReputationTraffic(pct) {
  const n = Math.min(100, Math.max(0, Number(pct) || 0));
  if (n < 40) return REPUTATION_TRAFFIC.red;
  if (n < 70) return REPUTATION_TRAFFIC.yellow;
  return REPUTATION_TRAFFIC.green;
}

export const REPUTATION_LEVELS = {
  none: {
    id: "none",
    label: "Sem avaliações",
    trust: "Ainda sem histórico de confiança",
    traffic: null,
  },
  low: {
    id: "low",
    label: "Em construção",
    trust: "Confiança em construção",
    traffic: "red",
  },
  mid: {
    id: "mid",
    label: "Em evolução",
    trust: "Confiança em evolução",
    traffic: "yellow",
  },
  good: {
    id: "good",
    label: "Boa confiança",
    trust: "Boa confiança na comunidade",
    traffic: "green",
  },
  top: {
    id: "top",
    label: "Excelente",
    trust: "Alta confiança na comunidade",
    traffic: "green",
  },
};

/**
 * @param {{ reputation?: number|null, hasEvaluations?: boolean, selectedAndEvaluatedCount?: number|null }} opts
 */
export function getReputationLevel({
  reputation,
  hasEvaluations,
  selectedAndEvaluatedCount,
} = {}) {
  const evaluated =
    typeof hasEvaluations === "boolean"
      ? hasEvaluations
      : (Number(selectedAndEvaluatedCount) || 0) > 0;

  if (!evaluated) return REPUTATION_LEVELS.none;

  const pct = Math.min(100, Math.max(0, Number(reputation) || 0));
  if (pct >= 85) return REPUTATION_LEVELS.top;
  if (pct >= 70) return REPUTATION_LEVELS.good;
  if (pct >= 40) return REPUTATION_LEVELS.mid;
  return REPUTATION_LEVELS.low;
}

export function getReputationPercent({
  reputation,
  hasEvaluations,
  selectedAndEvaluatedCount,
} = {}) {
  const evaluated =
    typeof hasEvaluations === "boolean"
      ? hasEvaluations
      : (Number(selectedAndEvaluatedCount) || 0) > 0;
  if (!evaluated) return 0;
  return Math.min(100, Math.max(0, Number(reputation) || 0));
}
