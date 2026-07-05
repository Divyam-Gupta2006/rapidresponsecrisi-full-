import type { IncidentDoc, IncidentStatus } from "../types";

const STEPS: { status: IncidentStatus; label: string }[] = [
  { status: "ACTIVE", label: "Reported" },
  { status: "ASSIGNED", label: "Assigned" },
  { status: "ACCEPTED", label: "Accepted" },
  { status: "EN_ROUTE", label: "En Route" },
  { status: "RESOLVED", label: "Resolved" },
];

const STATUS_INDEX: Record<IncidentStatus, number> = {
  ACTIVE: 0,
  ASSIGNED: 1,
  ACCEPTED: 2,
  EN_ROUTE: 3,
  RESOLVED: 4,
};

function formatTime(ts: unknown): string {
  if (!ts || typeof ts !== "object") return "—";
  const d = (ts as { toDate?: () => Date }).toDate?.();
  if (!d) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function StatusTimeline({
  incident,
}: {
  incident: IncidentDoc;
}) {
  const currentIdx = STATUS_INDEX[incident.status] ?? 0;

  const timestamps: Record<string, unknown> = {
    ACTIVE: incident.timestamp,
    ASSIGNED: incident.assignedAt,
    ACCEPTED: incident.acceptedAt,
    EN_ROUTE: incident.enRouteAt,
    RESOLVED: incident.resolvedAt,
  };

  return (
    <div className="flex items-center gap-1">
      {STEPS.map((step, i) => {
        const isDone = i <= currentIdx;
        const isCurrent = i === currentIdx;

        return (
          <div key={step.status} className="flex items-center gap-1">
            {/* Dot */}
            <div className="flex flex-col items-center">
              <div
                className={`h-3 w-3 rounded-full border-2 transition-colors ${
                  isCurrent
                    ? "border-danger bg-danger shadow-[0_0_8px_rgba(217,4,41,0.5)]"
                    : isDone
                    ? "border-success bg-success"
                    : "border-border-med bg-transparent"
                }`}
              />
              <span
                className={`mt-1 text-[9px] font-bold ${
                  isDone ? "text-neutral-300" : "text-muted"
                }`}
              >
                {step.label}
              </span>
              {isDone && timestamps[step.status] && (
                <span className="text-[8px] text-muted">
                  {formatTime(timestamps[step.status])}
                </span>
              )}
            </div>

            {/* Connector line */}
            {i < STEPS.length - 1 && (
              <div
                className={`h-0.5 w-4 flex-shrink-0 rounded ${
                  i < currentIdx ? "bg-success" : "bg-border-dim"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
