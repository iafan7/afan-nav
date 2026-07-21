"use client";

import { useState } from "react";

type Props = {
  title: string;
  description?: string | null;
  iconUrl?: string | null;
};

export function AdminSiteCell({ title, description, iconUrl }: Props) {
  const [failed, setFailed] = useState(false);
  const initial = title.trim().slice(0, 1).toUpperCase() || "?";
  const showImg = Boolean(iconUrl) && !failed;

  return (
    <div className="admin-site-cell">
      <span className="admin-site-icon">
        {showImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={iconUrl!} alt="" width={24} height={24} onError={() => setFailed(true)} />
        ) : (
          <span className="admin-site-fallback">{initial}</span>
        )}
      </span>
      <span className="admin-site-text">
        <span className="admin-site-title" title={title}>
          {title}
        </span>
        <span className="admin-site-desc" title={description?.trim() || undefined}>
          {description?.trim() || "—"}
        </span>
      </span>
    </div>
  );
}
