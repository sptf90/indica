"use client";

import { AdminFrame, AdminFeedback, useAdminResource } from "@/components/AdminWorkspace";
import DashboardSummary from "@/components/admin/DashboardSummary";
import DashboardTasks from "@/components/admin/DashboardTasks";
import RecentActivity from "@/components/admin/RecentActivity";
import { adminDate } from "@/lib/admin-catalog";

export default function AdminDashboard() {
  const { data, loading, error, reload } = useAdminResource("/api/admin/overview");
  const counts = data?.counts || {};
  return (
    <AdminFrame className="admin-overview" title="Visão geral"
      description="Acompanhe a comunidade e revise as pendências da operação."
      action={
        <div className="admin-overview-actions">
          <button type="button" className="pill-outline" disabled={loading} onClick={reload}>
            {loading ? "Atualizando…" : "Atualizar dados"}
          </button>
          {data?.checkedAt && <p className="admin-updated-at">Atualizado em <time dateTime={data.checkedAt}>{adminDate(data.checkedAt)}</time></p>}
        </div>
      }>
      <AdminFeedback loading={loading} error={error} reload={reload} />
      {!loading && !error && data ? <>
        <div className="admin-dashboard-content">
          <DashboardTasks counts={counts} />
          <RecentActivity items={data.recent} />
        </div>
        <DashboardSummary counts={counts} />
      </> : null}
    </AdminFrame>
  );
}
