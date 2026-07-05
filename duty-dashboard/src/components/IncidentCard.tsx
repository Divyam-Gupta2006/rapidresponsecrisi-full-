import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  Flame,
  HeartPulse,
  MapPin,
  ShieldAlert,
  Siren,
} from "lucide-react";
import type { IncidentDoc, EmergencyType, Priority } from "../types";

const TYPE_ICONS: Record<EmergencyType, React.ReactNode> = {
  FIRE: <Flame className="h-4 w-4" />,
  MEDICAL: <HeartPulse className="h-4 w-4" />,
  SECURITY: <ShieldAlert className="h-4 w-4" />,
  PANIC: <Siren className="h-4 w-4" />,
  OTHER: <AlertTriangle className="h-4 w-4" />,
};

const PRIORITY_STYLES: Record<Priority, string> = {
  HIGH: "bg-red-500/15 text-red-400 border-red-500/30",
  MEDIUM: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  LOW: "bg-green-500/15 text-green-400 border-green-500/30",
};

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-red-500/20 text-red-400",
  ASSIGNED: "bg-amber-500/20 text-amber-400",
  ACCEPTED: "bg-blue-500/20 text-blue-400",
  EN_ROUTE: "bg-purple-500/20 text-purple-400",
  RESOLVED: "bg-green-500/20 text-green-400",
};

export default function IncidentCard({
  incident,
  selected,
  onClick,
}: {
  incident: IncidentDoc;
  selected: boolean;
  onClick: () => void;
}) {
  const ts = incident.timestamp?.toDate?.();
  const timeAgo = ts
    ? formatDistanceToNow(ts, { addSuffix: true })
    : "just now";

  const isResolved = incident.status === "RESOLVED";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-2xl border p-4 transition-all duration-200
        ${
          selected
            ? "border-danger/50 bg-danger/5 shadow-[0_0_20px_rgba(217,4,41,0.1)]"
            : "border-border-dim bg-surface-2 hover:border-border-med hover:bg-surface-3"
        }
        ${isResolved ? "opacity-50" : ""}
      `}
    >
      {/* Top row: name + status */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-3 border border-border-dim">
            {TYPE_ICONS[incident.type] ?? TYPE_ICONS.OTHER}
          </div>
          <div>
            <p className="text-sm font-bold text-white">
              {incident.name || "Anonymous"}
            </p>
            <p className="text-xs text-muted">Room {incident.room}</p>
          </div>
        </div>
        <span
          className={`rounded-md px-2 py-0.5 text-[10px] font-black tracking-wider ${
            STATUS_STYLES[incident.status] ?? ""
          }`}
        >
          {incident.status.replace("_", " ")}
        </span>
      </div>

      {/* AI Summary */}
      <p className="mb-2 text-xs leading-relaxed text-neutral-400 line-clamp-2">
        {incident.aiSummary || "Processing..."}
      </p>

      {/* Bottom row: priority + distance + time */}
      <div className="flex items-center gap-2 text-[10px]">
        <span
          className={`rounded border px-1.5 py-0.5 font-black ${
            PRIORITY_STYLES[incident.priority] ?? ""
          }`}
        >
          {incident.priority}
        </span>

        {incident.distanceKm != null && (
          <span className="flex items-center gap-1 text-muted">
            <MapPin className="h-3 w-3" />
            {incident.distanceKm < 1
              ? `${Math.round(incident.distanceKm * 1000)}m`
              : `${incident.distanceKm.toFixed(1)}km`}
          </span>
        )}

        <span className="ml-auto text-muted">{timeAgo}</span>
      </div>
    </button>
  );
}
