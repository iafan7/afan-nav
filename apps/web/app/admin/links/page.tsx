import { LinksAdminClient } from "./LinksAdminClient";
import { getAdminCategories, getAdminLinks, getAdminSettings } from "@/lib/admin-data";
import { DEFAULT_LINK_CHECK_INTERVAL_MINUTES } from "@/lib/link-check-defaults";

export default async function LinksAdminPage() {
  const [categories, links, settings] = await Promise.all([
    getAdminCategories(),
    getAdminLinks(),
    getAdminSettings(),
  ]);
  return (
    <LinksAdminClient
      initialCategories={categories.map((c) => ({ id: c.id, name: c.name }))}
      initialLinks={links.map((row) => ({
        id: row.id,
        categoryId: row.categoryId,
        title: row.title,
        url: row.url,
        description: row.description,
        iconUrl: row.iconUrl,
        sortOrder: row.sortOrder,
        createdAt: row.createdAt,
        checkStatus: row.checkStatus === "valid" || row.checkStatus === "invalid" ? row.checkStatus : null,
        checkMessage: row.checkMessage ?? null,
        checkedAt: row.checkedAt ?? null,
      }))}
      linkCheckIntervalMinutes={
        settings?.linkCheckIntervalMinutes ?? DEFAULT_LINK_CHECK_INTERVAL_MINUTES
      }
    />
  );
}
