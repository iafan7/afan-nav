import { AdminTableSkeleton } from "@/components/LoadingStates";

/** Soft skeleton aligned with AdminPageHeader — avoids blank full-screen flash. */
export default function AdminLoading() {
  return (
    <div>
      <div className="admin-page-header">
        <div className="admin-page-heading">
          <div className="sk-block sk-title" style={{ width: 140, height: 28 }} />
          <div className="sk-block" style={{ width: 280, height: 14, marginTop: 8 }} />
        </div>
        <div className="sk-block" style={{ width: 96, height: 36, borderRadius: 8 }} />
      </div>
      <AdminTableSkeleton />
    </div>
  );
}
