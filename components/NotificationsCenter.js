"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client-api";

const FILTERS = [
  { id: "all", label: "Todas" },
  { id: "indications", label: "Indicações" },
  { id: "rankings", label: "Rankings" },
  { id: "scoring", label: "Pontuação" },
];

function formatWhen(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h`;
  return d.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
  });
}

export default function NotificationsCenter({ open, onClose, onUnreadChange }) {
  const [items, setItems] = useState([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [unreadByCategory, setUnreadByCategory] = useState({});
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const q =
        filter === "all" ? "" : `?category=${encodeURIComponent(filter)}`;
      const data = await api(`/api/notifications${q}`);
      setItems(data.items || []);
      setUnreadTotal(Number(data.unreadTotal) || 0);
      setUnreadByCategory(data.unreadByCategory || {});
      onUnreadChange?.(Number(data.unreadTotal) || 0);
    } catch (err) {
      setError(err.message || "Falha ao carregar notificações.");
    } finally {
      setLoading(false);
    }
  }, [filter, onUnreadChange]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function markOne(id) {
    setBusy(true);
    try {
      await api(`/api/notifications/${id}/read`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err.message || "Não foi possível marcar como lida.");
    } finally {
      setBusy(false);
    }
  }

  async function markAll() {
    setBusy(true);
    try {
      const body =
        filter === "all" ? {} : { category: filter };
      await api("/api/notifications/read-all", {
        method: "POST",
        body: JSON.stringify(body),
      });
      await load();
    } catch (err) {
      setError(err.message || "Não foi possível marcar todas.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const markAllLabel =
    filter === "all"
      ? "Marcar todas como lidas"
      : `Marcar todas em ${FILTERS.find((f) => f.id === filter)?.label || ""}`;

  return (
    <>
      <div
        className="notif-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="notif-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Central de notificações"
      >
        <header className="notif-drawer-head">
          <div>
            <p className="notif-kicker">Central</p>
            <h2 className="notif-title">Notificações</h2>
          </div>
          <button
            type="button"
            className="notif-close"
            aria-label="Fechar"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="notif-filters" role="tablist" aria-label="Categorias">
          {FILTERS.map((f) => {
            const count =
              f.id === "all"
                ? unreadTotal
                : Number(unreadByCategory[f.id]) || 0;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                className={`notif-filter${filter === f.id ? " active" : ""}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
                {count > 0 ? (
                  <span className="notif-filter-count">{count}</span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="notif-toolbar">
          <button
            type="button"
            className="linkish notif-mark-all"
            disabled={busy || unreadTotal === 0}
            onClick={markAll}
          >
            {markAllLabel}
          </button>
        </div>

        <div className="notif-list">
          {loading ? (
            <p className="muted notif-empty">Carregando…</p>
          ) : error ? (
            <p className="error-box">{error}</p>
          ) : items.length === 0 ? (
            <p className="muted notif-empty">Nenhuma notificação por aqui.</p>
          ) : (
            items.map((item) => (
              <article
                key={item.id}
                className={`notif-card${item.read ? " is-read" : " is-unread"}`}
              >
                <div className="notif-card-top">
                  <span className={`notif-cat notif-cat--${item.category}`}>
                    {item.categoryLabel}
                  </span>
                  <time dateTime={item.createdAt}>
                    {formatWhen(item.createdAt)}
                  </time>
                </div>
                <h3 className="notif-card-title">{item.title}</h3>
                <p className="notif-card-body">{item.body}</p>
                <div className="notif-card-actions">
                  <Link
                    href={item.deeplink || "/"}
                    className="notif-go"
                    onClick={() => {
                      if (!item.read) markOne(item.id);
                      onClose?.();
                    }}
                  >
                    Abrir
                  </Link>
                  {!item.read ? (
                    <button
                      type="button"
                      className="linkish"
                      disabled={busy}
                      onClick={() => markOne(item.id)}
                    >
                      Marcar como lida
                    </button>
                  ) : (
                    <span className="notif-read-label">Lida</span>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </aside>
    </>
  );
}
