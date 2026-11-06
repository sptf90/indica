"use client";

import { useState } from "react";
import { api } from "@/lib/client-api";
import IbgeCityPicker from "@/components/IbgeCityPicker";

export default function AdminRecordEditor({ section, record, onSaved, onCancel, onReload }) {
  const user = record.kind === "user";
  const [form, setForm] = useState({ username: record.username || "", email: record.email || "", photoUrl: record.photoUrl || "", legalName: record.legalName || "", logoUrl: record.logoUrl || "", isAdmin: record.isAdmin || false });
  const [city, setCity] = useState({ state: record.cityState || "", cityName: record.cityName || "", cityId: record.cityId });
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(null);
  const changedAccess = user && Boolean(form.isAdmin) !== Boolean(record.isAdmin);
  function update(key, value) { setForm(previous => ({ ...previous, [key]: value })); }
  async function save(event) {
    event.preventDefault(); setError(null);
    if (changedAccess && !confirmed) { setError({ message: "Confirme a alteração de acesso administrativo antes de salvar." }); return; }
    if (Boolean(city.state) !== Boolean(city.cityName)) { setError({ message: "Selecione a cidade e o estado, ou deixe ambos vazios." }); return; }
    setBusy(true);
    try {
      let cityId = city.cityId || null;
      if (!cityId && city.state && city.cityName) {
        const result = await api("/api/cities/ensure", { method: "POST", body: JSON.stringify({ name: city.cityName, state: city.state }) }); cityId = result.city.id;
      }
      const fields = user ? { username: form.username, email: form.email, photoUrl: form.photoUrl, isAdmin: form.isAdmin } : { legalName: form.legalName, logoUrl: form.logoUrl };
      const saved = await api(`/api/admin/data/${section}/${record.id}`, { method: "PATCH", body: JSON.stringify({ ...fields, cityId, revision: record.revision, reason }) });
      window.dispatchEvent(new Event("goindica:auth-changed")); onSaved(saved);
    } catch (err) { setError(err); } finally { setBusy(false); }
  }
  return <section className="admin-edit-panel" aria-labelledby="admin-edit-heading"><h2 id="admin-edit-heading">Editar {user ? "usuário" : "empresa"}</h2>
    <form className="admin-edit-form" onSubmit={save}>
      <fieldset disabled={busy} className="admin-edit-fields"><legend>Dados cadastrais</legend>
        {user ? <><label>Nome de usuário<input autoFocus value={form.username} onChange={event => update("username", event.target.value)} minLength={3} maxLength={40} required autoComplete="off" /></label><label>E-mail<input type="email" value={form.email} onChange={event => update("email", event.target.value)} maxLength={255} required autoComplete="off" /></label><label>Foto (URL)<input value={form.photoUrl} onChange={event => update("photoUrl", event.target.value)} maxLength={500} /></label></> : <><label>Razão social<input autoFocus value={form.legalName} onChange={event => update("legalName", event.target.value)} minLength={2} maxLength={255} required /></label><label>Logo (URL)<input value={form.logoUrl} onChange={event => update("logoUrl", event.target.value)} maxLength={500} /></label></>}
        <IbgeCityPicker state={city.state} cityName={city.cityName} required={!user} disabled={busy} onChange={next => setCity({ state: next.state, cityName: next.cityName, cityId: null })} />
        {user && city.state ? <button type="button" className="ghost-link" onClick={() => setCity({ state: "", cityName: "", cityId: null })}>Remover cidade do cadastro</button> : null}
      </fieldset>
      {user ? <fieldset disabled={busy} className="admin-edit-fields"><legend>Acesso administrativo</legend><label className="admin-checkbox"><input type="checkbox" checked={form.isAdmin} disabled={record.isSelf || record.accountType === "company"} onChange={event => { update("isAdmin", event.target.checked); setConfirmed(false); }} /><span>Permitir administrar o sistema</span></label><p className="muted">{record.isSelf ? "Seu próprio acesso administrativo permanece ativo." : record.accountType === "company" ? "Contas empresariais mantêm o perfil empresarial e não recebem acesso administrativo." : "Administradores podem consultar os registros do sistema e gerenciar cadastros e permissões."}</p>
        {changedAccess ? <div className="admin-access-confirm" role="status"><p>{form.isAdmin ? `Você está concedendo acesso administrativo a @${form.username}.` : `Você está removendo o acesso administrativo de @${form.username}.`}</p><label className="admin-checkbox"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>Confirmo esta alteração de permissão.</span></label></div> : null}
      </fieldset> : null}
      <label>Motivo da alteração<textarea value={reason} onChange={event => setReason(event.target.value)} minLength={5} maxLength={255} required disabled={busy} placeholder="Descreva o motivo para o histórico de auditoria." /></label>
      {error ? <div className="error-box" role="alert"><p>{error.message}</p>{error.status === 409 ? <button type="button" className="ghost-link" onClick={onReload}>Recarregar cadastro</button> : null}</div> : null}
      <div className="admin-inline-actions"><button type="submit" className="pill-cta" disabled={busy || (changedAccess && !confirmed)}>{busy ? "Salvando…" : "Salvar alterações"}</button><button type="button" className="pill-outline" disabled={busy} onClick={onCancel}>Cancelar</button></div>
    </form>
  </section>;
}
