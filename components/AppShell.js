"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import NotificationsCenter from "@/components/NotificationsCenter";
import ProductTour, { requestTutorialRestart } from "@/components/ProductTour";

const NAV_USER = [
  { href: "/", label: "Início", icon: "home", exact: true, tourId: "nav-inicio" },
  { href: "/pedir", label: "Pedir uma indicação", icon: "ask", exact: true, tourId: "nav-pedir" },
  { href: "/indicar", label: "Fazer uma indicação", icon: "give", tourId: "nav-indicar" },
  { href: "/pedir/meus", label: "Meus pedidos", icon: "orders", tourId: "nav-meus-pedidos" },
  { href: "/minhas-indicacoes", label: "Minhas indicações", icon: "sent", tourId: "nav-minhas-indicacoes" },
  { href: "/pontuacao", label: "Pontuação e credibilidade", icon: "score", tourId: "nav-pontuacao" },
  { href: "/rankings", label: "Rankings", icon: "rank", tourId: "nav-rankings" },
  { href: "/perfil", label: "Meu perfil", icon: "user", tourId: "nav-perfil" },
];

/** RF-EMP-05 / RF-SPON-10: empresa não pede/indica — só gestão. */
const NAV_COMPANY = [
  {
    href: "/empresa",
    label: "Patrocínio e resgates",
    icon: "gift",
    exact: true,
    tourId: "nav-empresa",
  },
  {
    href: "/rankings",
    label: "Seu ranking",
    icon: "rank",
    tourId: "nav-rankings-empresa",
  },
];

/** Admin: patrocínios + gestão de rankings (mensal/semanal). */
const NAV_ADMIN = [
  { href: "/admin", label: "Patrocínios", icon: "shield", exact: true },
  {
    href: "/admin/rankings",
    label: "Rankings",
    icon: "rank",
    children: [
      { href: "/admin/rankings/mensal", label: "Mensal" },
      { href: "/admin/rankings/semanal", label: "Semanal" },
    ],
  },
  { href: "/perfil", label: "Meu perfil", icon: "user" },
];

function NavIcon({ name }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };
  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V21h14V9.5" />
        </svg>
      );
    case "ask":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9.5a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 3.5" />
          <path d="M12 17h.01" />
        </svg>
      );
    case "give":
      return (
        <svg {...common}>
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
      );
    case "orders":
      return (
        <svg {...common}>
          <path d="M8 6h13" />
          <path d="M8 12h13" />
          <path d="M8 18h13" />
          <path d="M3 6h.01" />
          <path d="M3 12h.01" />
          <path d="M3 18h.01" />
        </svg>
      );
    case "sent":
      return (
        <svg {...common}>
          <path d="m22 2-7 20-4-9-9-4Z" />
          <path d="M22 2 11 13" />
        </svg>
      );
    case "score":
      return (
        <svg {...common}>
          <path d="m12 3 2.2 4.5 5 .7-3.6 3.5.9 5L12 14.8 7.5 16.7l.9-5L4.8 8.2l5-.7Z" />
        </svg>
      );
    case "rank":
      return (
        <svg {...common}>
          <path d="M8 21h8" />
          <path d="M12 17v4" />
          <path d="M7 4h10v5a5 5 0 0 1-10 0Z" />
          <path d="M5 9H3V7a2 2 0 0 1 2-2" />
          <path d="M19 9h2V7a2 2 0 0 0-2-2" />
        </svg>
      );
    case "mission":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1.5" />
        </svg>
      );
    case "gift":
      return (
        <svg {...common}>
          <rect x="3" y="8" width="18" height="13" rx="2" />
          <path d="M12 8v13" />
          <path d="M3 12h18" />
          <path d="M12 8c-2-3-5-3-5-1s2 2 5 1Z" />
          <path d="M12 8c2-3 5-3 5-1s-2 2-5 1Z" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 3 5 6v5c0 5 3.2 8.4 7 9.5 3.8-1.1 7-4.5 7-9.5V6l-7-3Z" />
          <path d="m9.5 12 1.8 1.8 3.7-3.8" />
        </svg>
      );
    case "user":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6" />
        </svg>
      );
    default:
      return null;
  }
}

function isActive(pathname, item) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export default function AppShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(undefined);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuReady, setMenuReady] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  const refreshUnread = useCallback(() => {
    fetch("/api/notifications?limit=1")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setUnreadNotifs(Number(data.unreadTotal) || 0);
      })
      .catch(() => {});
  }, []);

  const authFree =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/cadastro" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/register/") ||
    pathname.startsWith("/cadastro/");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setUser(data?.user || null);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    setMenuReady(true);
  }, []);

  useEffect(() => {
    if (!user || user.isCompany || user.isAdmin) {
      setUnreadNotifs(0);
      return undefined;
    }
    refreshUnread();
    const t = setInterval(refreshUnread, 60000);
    return () => clearInterval(t);
  }, [user, pathname, refreshUnread]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/login");
    router.refresh();
  }

  const displayName = user?.username || "você";
  const showSidebar = Boolean(user) && !authFree;
  const isCompany = Boolean(user?.isCompany);
  const isAdmin = Boolean(user?.isAdmin);
  const NAV = isCompany ? NAV_COMPANY : isAdmin ? NAV_ADMIN : NAV_USER;

  if (user === undefined) {
    return (
      <div className="app-frame loading-frame">
        <div className="boot-msg">Carregando…</div>
      </div>
    );
  }

  if (!showSidebar) {
    return (
      <div className="app-frame guest-frame">
        <header className="guest-header">
          <Link href="/" className="brand-mark">
            <img
              className="brand-logo"
              src="/brand/goindica-logo.png"
              alt="GoIndica"
              width={148}
              height={32}
            />
          </Link>
          <nav className="guest-nav">
            {user ? (
              <>
                <span className="header-user">Olá, {user.username}</span>
                <button type="button" className="linkish" onClick={logout}>
                  Sair
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="ghost-link">
                  Entrar
                </Link>
                <Link href="/cadastro" className="pill-cta">
                  Cadastrar
                </Link>
              </>
            )}
          </nav>
        </header>
        {children}
      </div>
    );
  }

  return (
    <div className={`app-frame auth-frame${menuOpen ? " menu-open" : ""}`}>
      <div
        className="sidebar-backdrop"
        onClick={() => setMenuOpen(false)}
        aria-hidden={!menuOpen}
      />
      <aside className={`sidebar${menuReady ? " ready" : ""}`} aria-label="Navegação">
        <Link
          href="/"
          className="brand-mark sidebar-brand"
          data-tour="brand-logo"
        >
          <img
            className="brand-logo"
            src="/brand/goindica-logo.png"
            alt="GoIndica"
            width={148}
            height={32}
          />
        </Link>
        <nav className="sidebar-nav">
          {NAV.map((item) => {
            if (item.children?.length) {
              const groupActive = isActive(pathname, item);
              return (
                <div
                  key={item.href + item.label}
                  className={`sidebar-group${groupActive ? " is-active" : ""}`}
                >
                  <Link
                    href={item.href}
                    className={`sidebar-link${groupActive ? " active" : ""}`}
                    data-tour={item.tourId || undefined}
                    onClick={() => setMenuOpen(false)}
                  >
                    <NavIcon name={item.icon} />
                    <span>{item.label}</span>
                  </Link>
                  <div className="sidebar-subnav" role="group" aria-label={item.label}>
                    {item.children.map((child) => {
                      const childActive = isActive(pathname, {
                        ...child,
                        exact: true,
                      });
                      return (
                        <Link
                          key={child.href + child.label}
                          href={child.href}
                          className={`sidebar-sublink${childActive ? " active" : ""}`}
                          onClick={() => setMenuOpen(false)}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            }

            const active = isActive(pathname, item);
            return (
              <Link
                key={item.href + item.label}
                href={item.href}
                className={`sidebar-link${active ? " active" : ""}`}
                data-tour={item.tourId || undefined}
                onClick={() => setMenuOpen(false)}
              >
                <NavIcon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <p className="sidebar-slogan">Você procura. Alguém indica.</p>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <button
            type="button"
            className="menu-toggle"
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
          <div className="topbar-spacer" />
          {!isCompany && !isAdmin ? (
            <button
              type="button"
              className={`notify-btn${unreadNotifs > 0 ? " has-unread" : ""}`}
              data-tour="notify-bell"
              aria-label={
                unreadNotifs > 0
                  ? `Notificações, ${unreadNotifs} não lidas`
                  : "Notificações"
              }
              aria-expanded={notifOpen}
              onClick={() => setNotifOpen(true)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M10 19a2 2 0 0 0 4 0"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
              {unreadNotifs > 0 ? (
                <span className="notify-badge" aria-hidden>
                  {unreadNotifs > 99 ? "99+" : unreadNotifs}
                </span>
              ) : null}
            </button>
          ) : null}
          <div className="topbar-user">
            <span className="avatar" aria-hidden>
              {(displayName || "?").slice(0, 1).toUpperCase()}
            </span>
            <span className="topbar-hello">Olá, {displayName}</span>
            <details className="user-menu">
              <summary className="user-menu-toggle" aria-label="Menu da conta">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="m6 9 6 6 6-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </summary>
              <div className="user-menu-panel">
                {isCompany ? (
                  <>
                    <Link href="/empresa" onClick={() => setMenuOpen(false)}>
                      Área da empresa
                    </Link>
                    <button
                      type="button"
                      data-testid="restart-tutorial-menu"
                      onClick={() => {
                        setMenuOpen(false);
                        requestTutorialRestart();
                      }}
                    >
                      Ver tutorial
                    </button>
                  </>
                ) : isAdmin ? (
                  <>
                    <Link href="/admin" onClick={() => setMenuOpen(false)}>
                      Admin patrocínio
                    </Link>
                    <Link href="/perfil" onClick={() => setMenuOpen(false)}>
                      Meu perfil
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/perfil" onClick={() => setMenuOpen(false)}>
                      Meu perfil
                    </Link>
                    <button
                      type="button"
                      data-testid="restart-tutorial-menu"
                      onClick={() => {
                        setMenuOpen(false);
                        requestTutorialRestart();
                      }}
                    >
                      Ver tutorial
                    </button>
                  </>
                )}
                <button type="button" onClick={logout}>
                  Sair
                </button>
              </div>
            </details>
          </div>
        </header>
        <div className="workspace-body workspace-body--dense">{children}</div>
      </div>

      {!isCompany && !isAdmin ? (
        <NotificationsCenter
          open={notifOpen}
          onClose={() => {
            setNotifOpen(false);
            refreshUnread();
          }}
          onUnreadChange={setUnreadNotifs}
        />
      ) : null}

      {!isAdmin ? (
        <ProductTour
          user={user}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
        />
      ) : null}
    </div>
  );
}
