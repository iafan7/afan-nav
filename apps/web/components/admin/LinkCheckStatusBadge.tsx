"use client";

import {
  buildCheckTooltip,
  deriveLinkHealth,
  healthBadgeClass,
  healthLabel,
  type LinkCheckFields,
  type LinkHealthUi,
} from "@/lib/link-check-ui";

type Props = {
  row: LinkCheckFields;
  checking?: boolean;
};

export function LinkCheckStatusBadge({ row, checking }: Props) {
  if (checking) {
    return (
      <span className="link-status-badge is-checking" title="检测中">
        检测中
      </span>
    );
  }

  const health: LinkHealthUi = deriveLinkHealth(row);
  const tip = buildCheckTooltip(row);

  return (
    <span
      className={`link-status-badge ${healthBadgeClass(health)}${row.checkError ? " has-probe-error" : ""}`}
      title={tip}
    >
      {healthLabel(health)}
    </span>
  );
}
