import { SettingsAdminClient } from "./SettingsAdminClient";
import { getAdminSearchEngines, getAdminSettings } from "@/lib/admin-data";
import { DEFAULT_LINK_CHECK_INTERVAL_MINUTES } from "@/lib/link-check-defaults";

export default async function SettingsAdminPage() {
  const [settings, engines] = await Promise.all([getAdminSettings(), getAdminSearchEngines()]);
  return (
    <SettingsAdminClient
      initialSiteName={settings?.siteName ?? "LinkNest"}
      initialOwnerNickname={settings?.ownerNickname ?? "阿凡"}
      initialLinkCheckIntervalMinutes={
        settings?.linkCheckIntervalMinutes ?? DEFAULT_LINK_CHECK_INTERVAL_MINUTES
      }
      initialDefaultSearchEngineId={settings?.defaultSearchEngineId ?? null}
      engines={engines.map((e) => ({ id: e.id, name: e.name }))}
    />
  );
}
