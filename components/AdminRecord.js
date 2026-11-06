"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { adminModule } from "@/lib/admin-catalog";
import { AdminFrame, AdminFeedback, AdminFields, useAdminResource } from "@/components/AdminWorkspace";
import AdminRecordEditor from "@/components/AdminRecordEditor";

export default function AdminRecord({ section, id }) {
  const meta = adminModule(section);
  const resource = useAdminResource(`/api/admin/data/${section}/${id}`);
  const [editing, setEditing] = useState(false), [saved, setSaved] = useState(null), [success, setSuccess] = useState("");
  const editRef = useRef(null);
  const data = saved || resource.data;
  function closeEditor() { setEditing(false); requestAnimationFrame(() => editRef.current?.focus()); }
  function reload() { setSaved(null); setEditing(false); setSuccess(""); resource.reload(); }
  return <AdminFrame title={data?.title || `${meta.singular} #${id}`} description={`Consulta administrativa de ${meta.singular.toLowerCase()} #${id}.`} back={{ href: `/admin/${section}`, title: meta.title }} action={!editing && data?.editable && !resource.loading && !resource.error ? <button ref={editRef} type="button" className="pill-cta" onClick={() => setEditing(true)}>Editar cadastro</button> : null}>
    <AdminFeedback loading={resource.loading} error={resource.error} reload={reload} />
    {success ? <p className="ok-box" role="status">{success}</p> : null}
    {!resource.loading && !resource.error && data ? <>
      {data.statusLabel ? <p className="admin-context-notice"><strong>Situação:</strong> {data.statusLabel}</p> : null}
      {editing && data.editable ? <AdminRecordEditor key={data.editable.revision} section={section} record={data.editable} onCancel={closeEditor} onReload={reload} onSaved={next => { setSaved(next); closeEditor(); setSuccess("Cadastro atualizado. A alteração foi registrada na auditoria."); }} /> : null}
      <section className="admin-record-panel" aria-label="Dados do registro"><h2>Dados do registro</h2><AdminFields fields={data.fields} />
        {data.location?.googleMaps || data.location?.waze ? <div className="admin-inline-actions">{data.location.googleMaps ? <a href={data.location.googleMaps} target="_blank" rel="noopener noreferrer" className="pill-outline">Abrir no Google Maps</a> : null}{data.location.waze ? <a href={data.location.waze} target="_blank" rel="noopener noreferrer" className="pill-outline">Abrir no Waze</a> : null}</div> : null}
      </section>
      {data.relations.length ? <section className="admin-record-panel" aria-label="Registros relacionados"><h2>Registros relacionados</h2><ul className="admin-related-links">{data.relations.map(link => <li key={link.href}><Link href={link.href}>{link.title}<span aria-hidden="true"> →</span></Link></li>)}</ul></section> : null}
    </> : null}
  </AdminFrame>;
}
