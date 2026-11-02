"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ReputationBadge from "@/components/ReputationBadge";
import { api } from "@/lib/client-api";

/** Perfil contextual público — reputação apenas, sem histórico. */
export default function PublicProfilePage() {
  const { username } = useParams();
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [self, setSelf] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/auth/me")
      .then((data) => {
        setSelf(data.user);
        if (
          data.user?.username &&
          String(username).toLowerCase() ===
            String(data.user.username).toLowerCase()
        ) {
          router.replace("/perfil");
          return null;
        }
        return api(`/api/profile/${encodeURIComponent(username)}`);
      })
      .then((data) => {
        if (data?.profile) setProfile(data.profile);
      })
      .catch((err) => {
        if (err.status === 401) router.replace("/login");
        else setError(err.message);
      });
  }, [username, router]);

  if (!profile && !error) {
    return (
      <main className="page page-perfil">
        <p className="muted">Carregando…</p>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="page page-perfil">
        <p className="error-box">{error}</p>
        <p className="auth-note">
          <Link href="/">Voltar ao início</Link>
        </p>
      </main>
    );
  }

  const cityLabel = profile.cityName
    ? `${profile.cityName}${
        profile.cityState ? ` - ${profile.cityState}` : ""
      }`
    : "Cidade não informada";

  return (
    <main className="page page-perfil page-perfil-public">
      <section className="perfil-hero reveal">
        <div className="perfil-hero-glow" aria-hidden />
        <div className="perfil-card">
          <div className="perfil-identity">
            <div className="perfil-avatar-wrap">
              {profile.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="perfil-avatar"
                  src={profile.photoUrl}
                  alt={`Foto de @${profile.username}`}
                />
              ) : (
                <span className="perfil-avatar placeholder" aria-hidden>
                  {(profile.username || "?").slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div className="perfil-identity-copy">
              <p className="eyebrow">Perfil</p>
              <h1>@{profile.username}</h1>
              <p className="lead">{cityLabel}</p>
              <div className="perfil-rep-hero">
                <ReputationBadge
                  reputation={profile.reputation}
                  hasEvaluations={profile.hasEvaluations}
                  selectedAndEvaluatedCount={profile.selectedAndEvaluatedCount}
                  reputationLabel={profile.reputationLabel}
                  size="profile"
                />
              </div>
              {profile.hasEvaluations ? (
                <p className="muted perfil-stats">
                  <span
                    title="Indicações avaliadas como válidas no histórico — não expiram."
                  >
                    Indicações válidas: {profile.validIndicationCount}
                  </span>
                </p>
              ) : null}
              <p className="muted">
                Histórico de reputação não é público. Pedidos e indicações
                privadas não estão disponíveis aqui.
              </p>
              <div className="toolbar">
                <Link
                  className="pill-outline"
                  href={self ? "/" : "/login"}
                >
                  Voltar
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
