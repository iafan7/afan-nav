import type { ReactNode } from "react";

type Props = {
  header: ReactNode;
  sidenav: ReactNode;
  children: ReactNode;
};

export function AppShell({ header, sidenav, children }: Props) {
  return (
    <div className="admin-shell">
      {header}
      <div className="admin-shell-body">
        {sidenav}
        <main className="main-panel">
          <div className="main-panel-inner">{children}</div>
        </main>
      </div>
    </div>
  );
}
