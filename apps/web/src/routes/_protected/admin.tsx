import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_protected/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <div className="min-h-screen bg-void p-8 text-biolum">
      <div className="mb-8 flex items-center gap-4">
        <h1 className="font-bold text-2xl text-biolum">Admin Console</h1>
        <div className="h-px flex-1 bg-white/10" />
      </div>
      <Outlet />
    </div>
  );
}
