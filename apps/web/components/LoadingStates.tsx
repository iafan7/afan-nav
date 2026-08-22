/** Theme-aware skeleton placeholders for loading states. */

export function HomeContentSkeleton() {
  return (
    <div className="sk-home" aria-busy="true" aria-label="加载中">
      {[0, 1].map((panel) => (
        <section key={panel} className="mn-category-panel sk-panel">
          <div className="sk-category-head">
            <span className="sk-block sk-icon" />
            <span className="sk-block sk-title" />
            <span className="sk-block sk-badge" />
          </div>
          <div className="mn-card-grid">
            {[0, 1, 2, 3].map((card) => (
              <div key={card} className="sk-link-card">
                <span className="sk-block sk-favicon" />
                <span className="sk-link-text">
                  <span className="sk-block sk-line-md" />
                  <span className="sk-block sk-line-sm" />
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function AdminTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="sk-table-wrap" aria-busy="true" aria-label="加载中">
      <table className="table sk-table">
        <thead>
          <tr>
            <th>标题</th>
            <th>URL</th>
            <th>分类</th>
            <th>排序</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, i) => (
            <tr key={i}>
              <td>
                <span className="sk-block sk-line-md" />
              </td>
              <td>
                <span className="sk-block sk-line-lg" />
              </td>
              <td>
                <span className="sk-block sk-line-sm" />
              </td>
              <td>
                <span className="sk-block sk-line-xs" />
              </td>
              <td>
                <span className="sk-block sk-line-sm" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SoftRefreshHint({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="soft-refresh soft-refresh--skeleton" role="status" aria-live="polite" aria-label="刷新中">
      <span className="sk-block sk-line-lg" />
      <span className="sk-block sk-line-md" />
      <span className="sk-block sk-line-sm" />
    </div>
  );
}
