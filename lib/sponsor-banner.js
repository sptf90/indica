/** Upload do banner do ranking patrocinado. */
export const SPONSOR_BANNER_UPLOAD = {
  width: 1200,
  height: 240,
  ratio: "5:1",
  ratioNumber: 5,
  /** Aceita arte entre 3:1 e 6:1; o slot 5:1 faz cover. */
  ratioMin: 3,
  ratioMax: 6,
  maxBytes: 3 * 1024 * 1024,
  label: "1200×240 px (ratio 5:1)",
  acceptHint: "ratio entre 3:1 e 6:1 (ideal 5:1 / 1200×240)",
};

export function bannerRatio(width, height) {
  const w = Number(width);
  const h = Number(height);
  if (!w || !h || h <= 0) return null;
  return w / h;
}

export function formatBannerRatio(width, height) {
  const r = bannerRatio(width, height);
  if (r == null) return "—";
  return `${r.toFixed(2).replace(/\.?0+$/, "")}:1`;
}

/** Aceita ratios próximos do canónico (3:1–6:1, com folga ~0.05). */
export function isSponsorBannerRatioOk(width, height) {
  const r = bannerRatio(width, height);
  if (r == null) return false;
  const slack = 0.05;
  return (
    r >= SPONSOR_BANNER_UPLOAD.ratioMin - slack &&
    r <= SPONSOR_BANNER_UPLOAD.ratioMax + slack
  );
}

export function sponsorBannerRejectMessage(width, height) {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  const shown = w && h ? `${w}×${h} (${formatBannerRatio(w, h)})` : "dimensões inválidas";
  return `Banner rejeitado: ${shown}. Aceitamos ${SPONSOR_BANNER_UPLOAD.acceptHint}; a prévia e o ranking usam enquadramento cover no slot 5:1.`;
}

export function isCanonicalSponsorBannerSize(width, height) {
  return (
    Number(width) === SPONSOR_BANNER_UPLOAD.width &&
    Number(height) === SPONSOR_BANNER_UPLOAD.height
  );
}
