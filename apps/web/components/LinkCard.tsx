"use client";

import { useState } from "react";

type Props = {
  title: string;
  url: string;
  description?: string | null;
  iconUrl?: string | null;
};

function faviconFallback(url: string) {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
  } catch {
    return null;
  }
}

export function LinkCard({ title, url, description, iconUrl }: Props) {
  const [failed, setFailed] = useState(false);
  const src = !failed ? iconUrl || faviconFallback(url) : null;
  const initial = title.trim().slice(0, 1).toUpperCase() || "?";

  return (
    <a className="mn-link-card" href={url} target="_blank" rel="noopener noreferrer">
      <span className="mn-link-card-icon">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            width={32}
            height={32}
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="mn-link-card-fallback">{initial}</span>
        )}
      </span>
      <span className="mn-link-card-body">
        <span className="mn-link-card-title">{title}</span>
        <span className="mn-link-card-desc">{description?.trim() || "快捷入口"}</span>
      </span>
    </a>
  );
}
