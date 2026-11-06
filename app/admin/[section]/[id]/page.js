import { notFound } from "next/navigation";
import { adminModule } from "@/lib/admin-catalog";
import AdminRecord from "@/components/AdminRecord";
export default async function AdminRecordPage({ params }) {
  const { section, id } = await params;
  if (!adminModule(section) || !/^[1-9]\d*$/.test(id)) notFound();
  return <AdminRecord key={`${section}:${id}`} section={section} id={id} />;
}
