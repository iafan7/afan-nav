"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppShell } from "@/components/layout/AppShell";
import { SideNav, type NavGroup } from "@/components/layout/SideNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  IconEngine,
  IconExport,
  IconFolders,
  IconLink,
  IconMenu,
  IconSettings,
} from "@/components/icons";

const NAV_GROUPS: NavGroup[] = [
  {
    id: "content",
    label: "内容",
    items: [
      { id: "links", label: "链接管理", href: "/admin/links", icon: <IconLink size={17} /> },
      {
        id: "categories",
        label: "分类管理",
        href: "/admin/categories",
        icon: <IconFolders size={17} />,
      },
      {
        id: "engines",
        label: "搜索引擎",
        href: "/admin/search-engines",
        icon: <IconEngine size={17} />,
      },
    ],
  },
  {
    id: "system",
    label: "系统",
    items: [
      { id: "settings", label: "站点设置", href: "/admin/settings", icon: <IconSettings size={17} /> },
    ],
  },
  {
    id: "data",
    label: "数据",
    items: [
      {
        id: "export",
        label: "数据导入导出",
        href: "/admin/export",
        icon: <IconExport size={17} />,
      },
    ],
  },
];

export function AdminShell({ siteName, children }: { siteName: string; children: ReactNode }) {
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <AppShell
      header={
        <AppHeader
          siteName={siteName}
          showAdminLink={false}
          showSiteLink
          brandHref="/admin/links"
          leading={
            <button
              type="button"
              className="btn btn-secondary admin-header-menu"
              aria-label="打开后台菜单"
              onClick={() => setNavOpen(true)}
            >
              <IconMenu size={18} />
            </button>
          }
          right={<ThemeToggle />}
        />
      }
      sidenav={
        <SideNav
          mobileLabel="菜单"
          groups={NAV_GROUPS}
          open={navOpen}
          onOpenChange={setNavOpen}
          footer={
            <button type="button" className="btn btn-secondary admin-logout-btn" onClick={logout}>
              登出
            </button>
          }
        />
      }
    >
      {children}
    </AppShell>
  );
}
