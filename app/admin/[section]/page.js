import { notFound } from "next/navigation";
import { adminModule } from "@/lib/admin-catalog";
import AdminRecords from "@/components/AdminRecords";
export default async function AdminSectionPage({ params, searchParams }) {
  const { section } = await params;
  if (!adminModule(section)) notFound();
  const filters = await searchParams;
  return <AdminRecords key={`${section}:${JSON.stringify(filters)}`} section={section} initialFilters={filters} />;
}
