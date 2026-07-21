import Link from "next/link";

type Props = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: string;
};

export function EmptyState({ title, description, action, icon = "N" }: Props) {
  return (
    <div className="empty-state">
      <div className="empty-visual" aria-hidden>
        {icon}
      </div>
      <h2 className="empty-title">{title}</h2>
      {description ? <p className="empty-desc">{description}</p> : null}
      {action ? <div className="empty-actions">{action}</div> : null}
    </div>
  );
}

export function EmptyStateLoginAction() {
  return (
    <Link href="/login" className="btn btn-primary" style={{ textDecoration: "none" }}>
      去管理后台
    </Link>
  );
}
