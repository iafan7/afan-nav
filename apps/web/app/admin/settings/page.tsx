import { SettingsAdminClient } from "./SettingsAdminClient";
import { getAdminSettings } from "@/lib/admin-data";

export default async function SettingsAdminPage() {
  const settings = await getAdminSettings();
  return (
    <SettingsAdminClient
      initialSiteName={settings?.siteName ?? "LinkNest"}
      initialOwnerNickname={settings?.ownerNickname ?? "阿凡"}
    />
  );
}
