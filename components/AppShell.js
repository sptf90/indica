"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { changeAdminView } from "@/lib/admin-view-client";
import SidebarNavigation from "@/components/SidebarNavigation";
import { navigationGroups } from "@/lib/navigation";
import NotificationsCenter from "@/components/NotificationsCenter";
import ProductTour, { requestTutorialRestart } from "@/components/ProductTour";

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
    function loadMe() {
      fetch("/api/auth/me")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!cancelled) setUser(data?.user || null);
        })
        .catch(() => {
          if (!cancelled) setUser(null);
        });
    }
    loadMe();
    function onAuthChanged() {
      loadMe();
    }
    window.addEventListener("goindica:auth-changed", onAuthChanged);
    return () => {
      cancelled = true;
      window.removeEventListener("goindica:auth-changed", onAuthChanged);
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

  async function exitPreview() {
    try {
      router.push(await changeAdminView("admin"));
      router.refresh();
    } catch {
      router.push("/admin");
    }
  }

  const displayName = user?.username || "você";
  const showSidebar = Boolean(user) && !authFree;
  const isCompany = Boolean(user?.isCompany);
  const isAdmin = Boolean(user?.isAdmin);
  const isRealAdmin = Boolean(user?.isRealAdmin);
  const viewAs = user?.viewAs || null;
  const previewMode =
    isRealAdmin && (viewAs === "user" || viewAs === "company")
      ? viewAs
      : null;
  const navGroups = navigationGroups({ isAdmin, isCompany });
  const homeHref = isAdmin ? "/admin" : isCompany ? "/empresa" : "/";

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
        <button className="sidebar-close" type="button" aria-label="Fechar navegação"
          onClick={() => { setMenuOpen(false); document.querySelector(".menu-toggle")?.focus(); }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <Link
          href={homeHref}
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
        <SidebarNavigation groups={navGroups} pathname={pathname} onNavigate={() => setMenuOpen(false)} />
        <p className="sidebar-slogan">Você procura. Alguém indica.</p>
      </aside>

      <div className="workspace">
        <div
          className={`workspace-sticky-head${previewMode ? " has-preview" : ""}`}
        >
          {previewMode ? (
            <div className="admin-preview-bar" role="status">
              <p>
                Visualizando como{" "}
                <strong>
                  {previewMode === "company" ? "empresa" : "usuário"}
                </strong>
                . Permissões e telas iguais a essa conta.
              </p>
              <button
                type="button"
                className="admin-preview-exit"
                onClick={exitPreview}
              >
                Voltar à gestão admin
              </button>
            </div>
          ) : null}
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
                      Gestão admin
                    </Link>
                    <Link
                      href="/admin/patrocinios"
                      onClick={() => setMenuOpen(false)}
                    >
                      Patrocínios
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
                    {previewMode ? (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          exitPreview();
                        }}
                      >
                        Voltar à gestão admin
                      </button>
                    ) : null}
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
        </div>
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
