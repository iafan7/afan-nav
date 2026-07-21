type Props = {
  className?: string;
};

/**
 * Official LinkNest page mark — switches by `data-theme`.
 * Uses transparent brand symbols only (never favicon / PWA icons).
 */
export function BrandMark({ className }: Props) {
  return (
    <span className={["brand-mark", className].filter(Boolean).join(" ")} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="brand-mark-img brand-mark-img-light"
        src="/brand/linknest-symbol-blue.png"
        alt=""
        width={32}
        height={32}
        decoding="async"
        draggable={false}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="brand-mark-img brand-mark-img-dark"
        src="/brand/linknest-symbol-white.png"
        alt=""
        width={32}
        height={32}
        decoding="async"
        draggable={false}
      />
    </span>
  );
}
