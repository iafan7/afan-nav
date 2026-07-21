import { SearchEnginesAdminClient } from "./SearchEnginesAdminClient";
import { getAdminSearchEngines, getAdminSettings } from "@/lib/admin-data";

export default async function SearchEnginesAdminPage() {
  const [engines, settings] = await Promise.all([getAdminSearchEngines(), getAdminSettings()]);
  return (
    <SearchEnginesAdminClient
      initialEngines={engines}
      defaultSearchEngineId={settings?.defaultSearchEngineId ?? null}
    />
  );
}
