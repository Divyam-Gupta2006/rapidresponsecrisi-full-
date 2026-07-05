import {
  LogOut,
  Radio,
  Shield,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useStaffProfile } from "../hooks/useStaffProfile";

const ROLE_LABELS: Record<string, string> = {
  security: "Security",
  medical: "Medical",
  fire: "Fire Response",
  general: "General",
};

export default function Header({
  activeCount,
}: {
  activeCount: number;
}) {
  const { staff, logout } = useAuth();
  const { updateStatus } = useStaffProfile(staff);

  if (!staff) return null;

  const isAvailable = staff.status === "AVAILABLE";

  const toggleStatus = async () => {
    await updateStatus(isAvailable ? "BUSY" : "AVAILABLE");
  };

  return (
    <header className="flex items-center justify-between border-b border-border-dim bg-surface-2 px-6 py-4">
      {/* Left — Branding */}
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger/15">
          <Shield className="h-5 w-5 text-danger" />
        </div>
        <div>
          <h1 className="text-sm font-black tracking-widest text-muted uppercase">
            Rapid Response
          </h1>
          <p className="text-lg font-bold text-white">{staff.name}</p>
        </div>
        <span className="ml-2 rounded-md bg-surface-3 px-2 py-0.5 text-xs font-bold text-muted">
          {ROLE_LABELS[staff.role] ?? staff.role}
        </span>
      </div>

      {/* Center — Active incidents */}
      {activeCount > 0 && (
        <div className="flex items-center gap-2 rounded-full bg-danger/10 px-4 py-1.5 animate-pulse-danger">
          <Radio className="h-4 w-4 text-danger" />
          <span className="text-xs font-black text-danger tracking-wider">
            {activeCount} ACTIVE
          </span>
        </div>
      )}

      {/* Right — Status + Logout */}
      <div className="flex items-center gap-4">
        <button
          onClick={toggleStatus}
          className="flex items-center gap-2 rounded-xl border border-border-dim bg-surface-3 px-4 py-2 transition-colors hover:border-border-med"
        >
          {isAvailable ? (
            <ToggleRight className="h-5 w-5 text-success" />
          ) : (
            <ToggleLeft className="h-5 w-5 text-muted" />
          )}
          <span
            className={`text-xs font-black tracking-wider ${
              isAvailable ? "text-success" : "text-muted"
            }`}
          >
            {isAvailable ? "AVAILABLE" : "BUSY"}
          </span>
        </button>

        <button
          onClick={logout}
          className="flex items-center gap-2 rounded-xl border border-border-dim bg-surface-3 px-3 py-2 text-muted transition-colors hover:border-danger/40 hover:text-danger"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
