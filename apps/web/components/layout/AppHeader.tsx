import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/BrandMark";
import { IconExternal } from "@/components/icons";

type Props = {
  siteName: string;
  center?: ReactNode;
  right?: ReactNode;
  /** Mobile/desktop leading control (e.g. admin menu button). */
  leading?: ReactNode;
  showAdminLink?: boolean;
  showSiteLink?: boolean;
  brandHref?: string;
  subtitle?: string;
};

export function AppHeader({
  siteName,
  center,
  right,
  leading,
  showAdminLink = true,
  showSiteLink = false,
  brandHref = "/",
  subtitle,
}: Props) {
  return (
    <header className="app-header">
      <div className="app-header-left">
        {leading}
        <Link href={brandHref} className="brand">
          <BrandMark />
          <span>
            <span className="brand-name">{siteName}</span>
            {subtitle ? <span className="brand-sub"> · {subtitle}</span> : null}
          </span>
        </Link>
      </div>
      <div className="app-header-center">{center}</div>
      <div className="app-header-right">
        {right}
        {showSiteLink ? (
          <Link
            href="/"
            className="btn btn-ghost app-header-site-link"
            aria-label="查看站点"
            title="查看站点"
          >
            <IconExternal size={16} />
            <span className="app-header-site-text">查看站点</span>
          </Link>
        ) : null}
        {showAdminLink ? (
          <Link href="/login" className="btn btn-ghost" style={{ textDecoration: "none", fontSize: 13 }}>
            管理
          </Link>
        ) : null}
      </div>
    </header>
  );
}
