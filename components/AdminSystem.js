"use client";

import { AdminFrame, AdminFeedback, useAdminResource } from "@/components/AdminWorkspace";
import ProfilePreview from "@/components/admin/ProfilePreview";
import SystemStatus from "@/components/admin/SystemStatus";

export default function AdminSystem() {
  const { data, loading, error, reload } = useAdminResource("/api/admin/system");
  return (
    <AdminFrame title="Sistema" description="Consulte as integrações e confira a experiência de cada perfil."
      action={<button type="button" className="pill-outline" disabled={loading} onClick={reload}>{loading ? "Verificando…" : "Verificar integrações"}</button>}>
      <AdminFeedback loading={loading} error={error} reload={reload} />
      {!loading && !error && data ? <>
        <SystemStatus status={data.integrations || {}} checkedAt={data.checkedAt} />
        <ProfilePreview />
      </> : null}
    </AdminFrame>
  );
}
