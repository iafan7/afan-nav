import { LinksAdminClient } from "./LinksAdminClient";
import { getAdminCategories, getAdminLinks } from "@/lib/admin-data";

export default async function LinksAdminPage() {
  const [categories, links] = await Promise.all([getAdminCategories(), getAdminLinks()]);
  return (
    <LinksAdminClient
      initialCategories={categories.map((c) => ({ id: c.id, name: c.name }))}
      initialLinks={links}
    />
  );
}
