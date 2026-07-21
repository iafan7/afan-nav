import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminSettings } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/auth/session";
import { ensureReady } from "@/lib/ready";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await ensureReady();
  const session = await requireAdmin();
  if (!session) {
    redirect("/login");
  }
  const settings = await getAdminSettings();
  return <AdminShell siteName={settings?.siteName ?? "LinkNest"}>{children}</AdminShell>;
}
