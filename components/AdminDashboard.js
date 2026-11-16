"use client";

import { AdminFrame, AdminFeedback, useAdminResource } from "@/components/AdminWorkspace";
import DashboardSummary from "@/components/admin/DashboardSummary";
import DashboardTasks from "@/components/admin/DashboardTasks";
import RecentActivity from "@/components/admin/RecentActivity";
import { adminDate } from "@/lib/admin-catalog";

export default function AdminDashboard() {
  const { data, loading, error, reload } = useAdminResource("/api/admin/overview");
  return (
    <AdminFrame title="Visão geral" description="Acompanhe a comunidade e o que precisa de atenção."
      action={<button type="button" className="pill-outline" disabled={loading} onClick={reload}>{loading ? "Atualizando…" : "Atualizar dados"}</button>}>
      <AdminFeedback loading={loading} error={error} reload={reload} />
      {!loading && !error && data ? <>
        <DashboardSummary counts={data.counts || {}} />
        <div className="admin-dashboard-content">
          <DashboardTasks counts={data.counts || {}} />
          <RecentActivity items={data.recent} />
        </div>
        <p className="admin-updated-at">Dados atualizados em <time dateTime={data.checkedAt}>{adminDate(data.checkedAt)}</time>.</p>
      </> : null}
    </AdminFrame>
  );
}
