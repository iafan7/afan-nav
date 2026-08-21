import { SettingsAdminClient } from "./SettingsAdminClient";
import { getAdminSettings } from "@/lib/admin-data";
import { DEFAULT_LINK_CHECK_INTERVAL_MINUTES } from "@/lib/link-check-defaults";

export default async function SettingsAdminPage() {
  const settings = await getAdminSettings();
  return (
    <SettingsAdminClient
      initialSiteName={settings?.siteName ?? "LinkNest"}
      initialOwnerNickname={settings?.ownerNickname ?? "阿凡"}
      initialLinkCheckIntervalMinutes={
        settings?.linkCheckIntervalMinutes ?? DEFAULT_LINK_CHECK_INTERVAL_MINUTES
      }
    />
  );
}
