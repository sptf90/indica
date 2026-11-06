"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import { adminDate } from "@/lib/admin-catalog";

export function useAdminResource(url) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [version, setVersion] = useState(0);
  const router = useRouter();
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setState(previous => ({ ...previous, loading: true, error: null }));
      try {
        const data = await api(url, { signal: controller.signal });
        if (!controller.signal.aborted) setState({ data, error: null, loading: false });
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error.status === 401) router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        setState({ data: null, error, loading: false });
      }
    }
    load();
    return () => controller.abort();
  }, [url, version, router]);
  return { ...state, reload: useCallback(() => setVersion(v => v + 1), []) };
}
export function AdminFrame({ title, description, children, back, action }) {
  return <main className="page page-admin admin-console">
    <nav className="admin-breadcrumb" aria-label="Navegação da gestão"><Link href="/admin">Admin</Link>{back ? <><span aria-hidden="true">/</span><Link href={back.href}>{back.title}</Link></> : null}<span aria-hidden="true">/</span><span>{title}</span></nav>
    <header className="admin-hero admin-hero-compact"><div className="admin-hero-main"><h1>{title}</h1><p className="lead admin-lead">{description}</p></div>{action}</header>
    {children}
  </main>;
}
export function AdminFeedback({ loading, error, reload }) {
  if (loading) return <p className="admin-console-state" role="status">Carregando registros…</p>;
  if (!error) return null;
  const denied = error.status === 403;
  return <section className="admin-console-state" role="alert"><h2>{denied ? "Acesso restrito" : error.status === 404 ? "Registro não encontrado" : "Não foi possível carregar"}</h2><p>{error.message}</p><div className="admin-inline-actions">{!denied ? <button type="button" className="pill-outline" onClick={reload}>Tentar novamente</button> : null}<Link className="ghost-link" href="/admin">Voltar à gestão</Link></div></section>;
}
export function AdminFields({ fields }) {
  return <dl className="admin-record-fields">{fields.map((field, index) => <div key={`${field.label}-${index}`}><dt>{field.label}</dt><dd>{field.type === "json" ? <pre>{field.value ? JSON.stringify(field.value, null, 2) : "—"}</pre> : field.href && field.value ? <Link href={field.href} {...(/^https?:/.test(field.href) ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{String(field.value)}</Link> : field.type === "date" ? adminDate(field.value) : field.value === null || field.value === undefined || field.value === "" ? "—" : String(field.value)}</dd></div>)}</dl>;
}
