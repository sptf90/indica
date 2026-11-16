"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { changeAdminView } from "@/lib/admin-view-client";

export default function ProfilePreview() {
  const router = useRouter();
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");

  async function enterPreview(mode) {
    setError("");
    setLoading(mode);
    try {
      router.push(await changeAdminView(mode));
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading("");
    }
  }

  return (
    <section className="admin-record-panel" aria-labelledby="admin-preview-heading">
      <h2 id="admin-preview-heading">Prévias de perfis</h2>
      <p className="admin-section-caption">Confira a experiência de usuário ou empresa. Use “Voltar à gestão admin” no cabeçalho para sair da prévia.</p>
      {error ? <p className="error-box" role="alert">{error}</p> : null}
      <div className="admin-inline-actions">
        <button type="button" className="pill-outline" disabled={Boolean(loading)} onClick={() => enterPreview("user")}>{loading === "user" ? "Abrindo…" : "Ver como usuário"}</button>
        <button type="button" className="pill-outline" disabled={Boolean(loading)} onClick={() => enterPreview("company")}>{loading === "company" ? "Abrindo…" : "Ver como empresa"}</button>
      </div>
    </section>
  );
}
