import { PublicHome } from "@/components/PublicHome";
import { requireAdminIfSessionCookie } from "@/lib/auth/session";
import { getPublicNavigation, getPublicSite } from "@/lib/services/navigation";

export default async function HomePage() {
  const admin = await requireAdminIfSessionCookie();
  const [site, navigation] = await Promise.all([
    getPublicSite(),
    getPublicNavigation({ includePrivate: Boolean(admin) }),
  ]);

  return <PublicHome initialSite={site} initialNavigation={navigation} />;
}
