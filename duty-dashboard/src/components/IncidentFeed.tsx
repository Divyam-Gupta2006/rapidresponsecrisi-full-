import type { IncidentDoc } from "../types";
import { INCIDENT_STATUS_ORDER } from "../types";
import IncidentCard from "./IncidentCard";
import { Activity } from "lucide-react";

export default function IncidentFeed({
  incidents,
  selectedId,
  onSelect,
}: {
  incidents: IncidentDoc[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  // Sort: unresolved first (by lifecycle stage), then resolved at bottom
  const sorted = [...incidents].sort((a, b) => {
    const aOrder = INCIDENT_STATUS_ORDER[a.status] ?? 99;
    const bOrder = INCIDENT_STATUS_ORDER[b.status] ?? 99;

    // Resolved goes to bottom
    if (a.status === "RESOLVED" && b.status !== "RESOLVED") return 1;
    if (b.status === "RESOLVED" && a.status !== "RESOLVED") return -1;

    // Among active, earlier in lifecycle = higher priority
    if (aOrder !== bOrder) return aOrder - bOrder;

    // Same status: newer first
    const aTime = a.timestamp?.toMillis?.() ?? 0;
    const bTime = b.timestamp?.toMillis?.() ?? 0;
    return bTime - aTime;
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border-dim px-4 py-3">
        <Activity className="h-4 w-4 text-muted" />
        <h2 className="text-xs font-black tracking-widest text-muted uppercase">
          Incident Feed
        </h2>
        <span className="ml-auto rounded-md bg-surface-3 px-2 py-0.5 text-xs font-bold text-muted">
          {incidents.filter((i) => i.status !== "RESOLVED").length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted">
            <Activity className="mb-3 h-8 w-8 opacity-30" />
            <p className="text-sm font-medium">No incidents</p>
            <p className="text-xs">Assignments will appear here</p>
          </div>
        ) : (
          sorted.map((inc) => (
            <IncidentCard
              key={inc.id}
              incident={inc}
              selected={inc.id === selectedId}
              onClick={() => onSelect(inc.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
