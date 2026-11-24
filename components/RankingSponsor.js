import Image from "next/image";
import Link from "next/link";
import MobileHelp from "@/components/MobileHelp";
import { SPONSOR_BANNER_UPLOAD } from "@/lib/sponsor-banner";

const BANNER_FULL = "/rankings/sponsor-banner-full.jpg";

export function SponsorHero({ ranking, preview = false }) {
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
        priority={!preview}
        className="rm-sponsor-hero-img"
        sizes="(max-width: 720px) 100vw, min(84rem, 100vw)"
        unoptimized
      />
      <p className="rm-banner-crumb">
        {preview ? <span>← Rankings</span> : <Link href="/rankings">← Rankings</Link>}
      </p>
    </section>
  );
}

export function SponsorSupportCard({ ranking }) {
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
  const siteHref = ranking.sponsorSiteUrl || null;
  const ctaIcon = (
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
  );
  return (
    <aside className="rm-side-card rm-sponsor-support">
      <MobileHelp heading={<h2>Este ranking tem o apoio de {name}</h2>} label="Sobre o apoio do patrocinador">
        A marca apoia o reconhecimento de quem ajuda a comunidade com
        indicações confirmadas neste período.
      </MobileHelp>
      <div className="rm-sponsor-support-visual rm-sponsor-brand-visual">
        {ranking.sponsorLogoUrl ? (
          <Image
            src={ranking.sponsorLogoUrl}
            alt={`Logotipo de ${name}`}
            width={240}
            height={96}
            className="rm-sponsor-support-logo"
            unoptimized
          />
        ) : (
          <span className="rm-sponsor-wordmark">{name}</span>
        )}
      </div>
      {siteHref ? (
        <a
          className="rm-sponsor-cta"
          href={siteHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          Conhecer {name}
          {ctaIcon}
        </a>
      ) : (
        <span className="rm-sponsor-cta is-disabled" role="text">
          Conhecer {name}
          {ctaIcon}
        </span>
      )}
    </aside>
  );
}
