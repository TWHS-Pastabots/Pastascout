import { Navigate } from "react-router-dom";
import type { Role } from "../state/appStore";
import { useAppStore } from "../state/appStore";

export function RequireRole({ role, children }: { role: Role; children: React.ReactNode }) {
  const currentRole = useAppStore((s) => s.role);
  if (currentRole !== role) return <Navigate to="/" replace />;
  return <>{children}</>;
}
