import { DesktopShell } from "@/components/desktop/shell";
import { ProtectedRoute } from "@/components/protected-route";

export default function DesktopScreen() {
  return (
    <ProtectedRoute>
      <DesktopShell />
    </ProtectedRoute>
  );
}
