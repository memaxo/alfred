import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Monitor } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_protected/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <div className="min-h-screen bg-void p-8 font-sans text-biolum">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="font-bold text-2xl text-biolum">Admin Console</h1>
          <div className="h-px w-24 bg-white/10" />
        </div>
        <Link search={{ spawn: "admin" }} to="/">
          <Button className="gap-2" variant="outline">
            <Monitor className="h-4 w-4" />
            Open in Desktop
          </Button>
        </Link>
      </div>
      <Outlet />
    </div>
  );
}
