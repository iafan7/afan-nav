import { CategoriesAdminClient } from "./CategoriesAdminClient";
import { getAdminCategories } from "@/lib/admin-data";

export default async function CategoriesAdminPage() {
  const categories = await getAdminCategories();
  return <CategoriesAdminClient initialCategories={categories} />;
}
