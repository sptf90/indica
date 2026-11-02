"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ReputationBadge from "@/components/ReputationBadge";
import { requestTutorialRestart } from "@/components/ProductTour";
import { api } from "@/lib/client-api";

function formatDelta(delta) {
  const n = Number(delta) || 0;
  if (n > 0) return `+${n}`;
  return String(n);
}

export default function PerfilPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [cities, setCities] = useState([]);
  const [history, setHistory] = useState([]);
  const [username, setUsername] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [cityId, setCityId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteAck, setDeleteAck] = useState(false);
  const [deletePin, setDeletePin] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    Promise.all([
      api("/api/auth/me"),
      api("/api/cities"),
      api("/api/profile/reputation-history"),
    ])
      .then(([me, citiesData, hist]) => {
        setUser(me.user);
        setUsername(me.user.username || "");
        setPhotoUrl(me.user.photoUrl || "");
        setCityId(
          me.user.cityId != null ? String(me.user.cityId) : ""
        );
        setCities(citiesData.cities || []);
        setHistory(hist.items || []);
      })
      .catch((err) => {
        if (err.status === 401) router.replace("/login");
        else setError(err.message);
      });
  }, [router]);

  async function onSave(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const data = await api("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          username: username.trim(),
          photoUrl: photoUrl.trim() || null,
          cityId: cityId ? Number(cityId) : null,
        }),
      });
      setUser(data.user);
      setUsername(data.user.username || "");
      setPhotoUrl(data.user.photoUrl || "");
      setCityId(
        data.user.cityId != null ? String(data.user.cityId) : ""
      );
      setSuccess("Perfil atualizado.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteAccount(event) {
    event.preventDefault();
    setDeleteError("");
    if (!deleteAck) {
      setDeleteError("Confirme que leu o aviso antes de excluir.");
      return;
    }
    setDeleting(true);
    try {
      await api("/api/account/delete", {
        method: "POST",
        body: JSON.stringify({ password: deletePin }),
      });
      router.replace("/login?deleted=1");
      router.refresh();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  async function onPhotoFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setSuccess("");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("photo", file);
      const response = await fetch("/api/profile/photo", {
        method: "POST",
        body: form,
      });
      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }
      if (!response.ok) {
        throw Object.assign(
          new Error(data?.error || "Falha no upload da foto."),
          { status: response.status }
        );
      }
      setUser(data.user);
      setPhotoUrl(data.user.photoUrl || "");
      setSuccess("Foto atualizada.");
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  if (!user && !error) {
    return (
      <main className="page page-perfil">
        <p className="muted">Carregando…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="page page-perfil">
        <p className="error-box">{error}</p>
      </main>
    );
  }

  const cityLabel = user.cityName
    ? `${user.cityName}${user.cityState ? ` - ${user.cityState}` : ""}`
    : "Cidade não informada";

  return (
    <main className="page page-wide page-perfil">
      <section className="perfil-hero reveal">
        <div className="perfil-hero-glow" aria-hidden />
        <div className="perfil-card">
          <div className="perfil-identity">
            <div className="perfil-avatar-wrap">
              {photoUrl || user.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="perfil-avatar"
                  src={photoUrl || user.photoUrl}
                  alt={`Foto de @${user.username}`}
                />
              ) : (
                <span className="perfil-avatar placeholder" aria-hidden>
                  {(user.username || "?").slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div className="perfil-identity-copy">
              <p className="eyebrow">Meu perfil</p>
              <h1>@{user.username}</h1>
              <p className="lead">{cityLabel}</p>
              <div className="perfil-rep-hero" data-tour="perfil-rep">
                <ReputationBadge
                  reputation={user.reputation}
                  hasEvaluations={user.hasEvaluations}
                  selectedAndEvaluatedCount={user.selectedAndEvaluatedCount}
                  reputationLabel={user.reputationLabel}
                  size="profile"
                />
              </div>
              {user.hasEvaluations ? (
                <p className="muted perfil-stats">
                  <span
                    title="Indicações avaliadas como válidas no histórico — não expiram."
                  >
                    Indicações válidas: {user.validIndicationCount}
                  </span>{" "}
                  · Avaliações: {user.selectedAndEvaluatedCount}
                </p>
              ) : null}
              <div className="perfil-tutorial-row">
                <button
                  type="button"
                  className="pill-outline sm"
                  data-testid="restart-tutorial-perfil"
                  onClick={() => requestTutorialRestart()}
                >
                  Ver tutorial
                </button>
              </div>
              <div
                className="perfil-share-block"
                data-testid="perfil-share-link"
                data-tour="perfil-share"
              >
                <p className="perfil-share-count">
                  Acessos pelo meu link:{" "}
                  <strong data-testid="share-visit-count">
                    {Number(user.shareVisitCount) || 0}
                  </strong>
                </p>
                <p className="muted perfil-share-hint">
                  Pessoas distintas que entraram pelo teu link (desempate do
                  ranking).
                </p>
                {user.sharePath || user.shareCode ? (
                  <div className="perfil-share-url-row">
                    <code className="perfil-share-url" data-testid="share-path">
                      {`${origin || ""}${user.sharePath || `/r/${user.shareCode}`}`}
                    </code>
                    <button
                      type="button"
                      className="pill-outline sm"
                      data-testid="share-copy"
                      onClick={async () => {
                        const path = user.sharePath || `/r/${user.shareCode}`;
                        const full = `${origin || window.location.origin}${path}`;
                        try {
                          await navigator.clipboard.writeText(full);
                          setSuccess("Link copiado.");
                        } catch {
                          setError("Não foi possível copiar o link.");
                        }
                      }}
                    >
                      Copiar link
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <form className="perfil-edit-form" onSubmit={onSave}>
            <h2>Editar dados</h2>
            <p className="muted perfil-edit-lead">
              Nome, foto e cidade. A cidade vira o padrão em “Fazer uma
              indicação”; pedidos antigos não mudam.
            </p>

            <label>
              Nome de usuário
              <span className="hint">Único na plataforma · 3–40 caracteres</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                minLength={3}
                maxLength={40}
                pattern="[A-Za-z0-9_]{3,40}"
                title="Letras, números e underscore"
              />
            </label>

            <label>
              Foto (URL)
              <span className="hint">
                Cole uma URL ou envie um arquivo abaixo
              </span>
              <input
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="https://… ou /uploads/…"
                maxLength={500}
              />
            </label>

            <label className="perfil-upload">
              Enviar foto
              <span className="hint">JPG, PNG, WEBP ou GIF · até 2 MB</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={onPhotoFile}
                disabled={uploading}
              />
            </label>

            <label>
              Cidade
              <select
                value={cityId}
                onChange={(e) => setCityId(e.target.value)}
                required
              >
                <option value="">Selecione</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="toolbar">
              <button className="pill-cta" type="submit" disabled={saving}>
                {saving ? "Salvando…" : "Salvar alterações"}
              </button>
              <Link className="pill-outline" href="/perfil/reputacao">
                Histórico de reputação
              </Link>
            </div>
          </form>

          {success ? <p className="ok-box">{success}</p> : null}
          {error ? <p className="error-box">{error}</p> : null}
          {uploading ? <p className="muted">Enviando foto…</p> : null}
        </div>
      </section>

      <section className="perfil-side reveal delay-1">
        <div className="perfil-panel">
          <h2>Histórico de reputação</h2>
          <p className="muted">Privado — só você vê estas entradas.</p>
          {history.length === 0 ? (
            <p className="muted">
              Ainda não há avaliações que alterem a reputação.
            </p>
          ) : (
            <ul className="activity-list">
              {history.slice(0, 6).map((item) => (
                <li key={item.id}>
                  <div className="activity-row static">
                    <span className="activity-body">
                      <span className="activity-title">{item.requestTitle}</span>
                      <span className="activity-meta">
                        {item.createdAt
                          ? new Date(item.createdAt).toLocaleString("pt-BR")
                          : ""}
                        {" · "}
                        {item.outcome === "valid" ? "Válida" : "Não válida"}
                        {" · "}
                        {item.reputationBefore} → {formatDelta(item.delta)} →{" "}
                        {item.reputationAfter}
                      </span>
                    </span>
                    <span
                      className={`status-badge ${
                        item.outcome === "valid" ? "ok" : "muted"
                      }`}
                    >
                      {formatDelta(item.delta)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {history.length > 6 ? (
            <p className="auth-note">
              <Link href="/perfil/reputacao">Ver histórico completo</Link>
            </p>
          ) : null}
        </div>

        <div className="perfil-panel perfil-empresa-stub">
          <p className="eyebrow">Conta empresarial</p>
          <h2>Sou empresa</h2>
          <p className="muted">
            Cadastro por CNPJ para patrocinar rankings e confirmar resgates —
            sem catálogo público e sem pedir ou indicar.
          </p>
          <Link className="pill-outline" href="/empresa">
            Ir para área da empresa
          </Link>
        </div>

        <section
          className="perfil-panel perfil-danger-zone"
          data-testid="account-deletion"
          aria-labelledby="excluir-conta-titulo"
        >
          <p className="eyebrow danger">Zona de risco</p>
          <h2 id="excluir-conta-titulo">Excluir conta</h2>
          <p className="muted">
            Exclusão definitiva e imediata. Dados pessoais são removidos; onde
            ainda for necessário aparecer, o nome vira{" "}
            <strong>Usuário excluído</strong>. Pedidos em andamento são
            encerrados; pontos em rankings ativos congelam; o username fica
            livre para um cadastro novo (sem restaurar histórico).
          </p>

          {!deleteOpen ? (
            <button
              type="button"
              className="pill-danger"
              data-testid="account-deletion-open"
              onClick={() => {
                setDeleteOpen(true);
                setDeleteError("");
              }}
            >
              Quero excluir minha conta
            </button>
          ) : (
            <form
              className="perfil-delete-form"
              onSubmit={onDeleteAccount}
              data-testid="account-deletion-form"
            >
              <div className="perfil-delete-warning" role="alert">
                <p>
                  <strong>Atenção:</strong> esta ação não pode ser desfeita.
                </p>
                <ul>
                  <li>Login desta conta deixa de funcionar na hora.</li>
                  <li>Pedidos seus em andamento são encerrados agora.</li>
                  <li>
                    Rankings ativos: pontos congelados, sem novos ganhos ou
                    perdas.
                  </li>
                  <li>
                    Indicações que você fez a terceiros permanecem, com autor
                    anonimizado.
                  </li>
                </ul>
              </div>

              <label className="perfil-delete-ack">
                <input
                  type="checkbox"
                  checked={deleteAck}
                  onChange={(e) => setDeleteAck(e.target.checked)}
                  data-testid="account-deletion-ack"
                />
                <span>Li o aviso e quero excluir definitivamente.</span>
              </label>

              <label>
                Confirme com sua senha numérica
                <span className="hint">
                  PIN de pelo menos 6 dígitos (reautenticação)
                  {/* GOOGLE_OAUTH_INTEGRATION_POINT: trocar/adicionar botão Google */}
                </span>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="\d{6,}"
                  autoComplete="current-password"
                  value={deletePin}
                  onChange={(e) => setDeletePin(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••"
                  data-testid="account-deletion-pin"
                />
              </label>

              {deleteError ? (
                <p className="error-box">{deleteError}</p>
              ) : null}

              <div className="toolbar">
                <button
                  type="submit"
                  className="pill-danger"
                  disabled={deleting || !deleteAck}
                  data-testid="account-deletion-confirm"
                >
                  {deleting ? "Excluindo…" : "Excluir definitivamente"}
                </button>
                <button
                  type="button"
                  className="pill-outline"
                  disabled={deleting}
                  onClick={() => {
                    setDeleteOpen(false);
                    setDeleteAck(false);
                    setDeletePin("");
                    setDeleteError("");
                  }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </section>
      </section>
    </main>
  );
}
