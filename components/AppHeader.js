"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);

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

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="app-header">
      <Link href="/" className="brand">
        Indica
      </Link>
      <nav className="header-nav">
        {user ? (
          <>
            <span className="header-user">@{user.username}</span>
            <button type="button" className="linkish" onClick={logout}>
              Sair
            </button>
          </>
        ) : (
          <>
            <Link href="/login">Entrar</Link>
            <Link href="/register">Cadastrar</Link>
          </>
        )}
      </nav>
    </header>
  );
}
