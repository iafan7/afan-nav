import { CategoriesAdminClient } from "./CategoriesAdminClient";
import { getAdminCategories, getAdminLinks } from "@/lib/admin-data";

export default async function CategoriesAdminPage() {
  const [categories, links] = await Promise.all([getAdminCategories(), getAdminLinks()]);
  const counts = new Map<string, number>();
  for (const link of links) {
    counts.set(link.categoryId, (counts.get(link.categoryId) ?? 0) + 1);
  }
  return (
    <CategoriesAdminClient
      initialCategories={categories.map((c) => ({
        id: c.id,
        name: c.name,
        sortOrder: c.sortOrder,
        visibility: c.visibility,
        updatedAt: c.updatedAt,
        linkCount: counts.get(c.id) ?? 0,
      }))}
    />
  );
}
