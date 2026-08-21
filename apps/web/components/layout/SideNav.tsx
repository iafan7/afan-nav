"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

export type NavItem = {
  id: string;
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: ReactNode;
};

type Props = {
  items: NavItem[];
  /** Optional section label. Omit to show menu directly under the logo. */
  title?: string;
  mobileLabel?: string;
  footer?: ReactNode;
  activeId?: string | null;
  emptyHint?: string;
  /** Controlled drawer open state (admin header menu). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function SideNav({
  items,
  title,
  mobileLabel = "菜单",
  footer,
  activeId,
  emptyHint,
  open: openProp,
  onOpenChange,
}: Props) {
  const pathname = usePathname();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const controlled = openProp !== undefined && onOpenChange !== undefined;
  const open = controlled ? openProp : uncontrolledOpen;

  function setOpen(next: boolean) {
    if (controlled) onOpenChange(next);
    else setUncontrolledOpen(next);
  }

  const ariaLabel = title?.trim() || mobileLabel;

  function isActive(item: NavItem) {
    if (activeId != null) return item.id === activeId;
    if (!item.href) return false;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  const list = (
    <nav className="side-nav-list" aria-label={ariaLabel}>
      {items.length === 0 && emptyHint ? <div className="side-nav-empty">{emptyHint}</div> : null}
      {items.map((item) => {
        const active = isActive(item);
        const className = `side-nav-item${active ? " is-active" : ""}`;
        const content = (
          <>
            {item.icon ? <span className="side-nav-icon">{item.icon}</span> : null}
            <span className="side-nav-label">{item.label}</span>
          </>
        );
        if (item.href) {
          return (
            <Link key={item.id} href={item.href} className={className} onClick={() => setOpen(false)}>
              {content}
            </Link>
          );
        }
        return (
          <button
            key={item.id}
            type="button"
            className={className}
            onClick={() => {
              item.onClick?.();
              setOpen(false);
            }}
          >
            {content}
          </button>
        );
      })}
    </nav>
  );

  return (
    <>
      <aside
        id="desktop-sidenav"
        className={`side-nav side-nav-desktop${title ? "" : " side-nav--no-title"}`}
      >
        {title ? <div className="side-nav-title">{title}</div> : null}
        {list}
        {footer ? <div className="side-nav-footer">{footer}</div> : null}
      </aside>
      {open ? (
        <>
          <div className="overlay" onClick={() => setOpen(false)} />
          <aside className={`side-nav side-nav-drawer${title ? "" : " side-nav--no-title"}`}>
            <div className="side-nav-drawer-head">
              <strong>{title || mobileLabel}</strong>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                关闭
              </button>
            </div>
            {list}
            {footer ? <div className="side-nav-footer">{footer}</div> : null}
          </aside>
        </>
      ) : null}
    </>
  );
}
