"use client";

import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  badge?: ReactNode;
  actions?: ReactNode;
};

/** Shared admin page chrome: title + short desc + right actions. */
export function AdminPageHeader({ title, description, badge, actions }: Props) {
  return (
    <div className="admin-page-header">
      <div className="admin-page-heading">
        <h1 className="admin-page-title">
          {title}
          {badge}
        </h1>
        {description ? <p className="admin-page-desc">{description}</p> : null}
      </div>
      {actions ? <div className="admin-toolbar-actions">{actions}</div> : null}
    </div>
  );
}
