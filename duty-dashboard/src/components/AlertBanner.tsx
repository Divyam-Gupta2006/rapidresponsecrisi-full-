import { useEffect, useState } from "react";
import { Siren, X } from "lucide-react";
import type { IncidentDoc } from "../types";

/**
 * Full-width alert banner that slides in when a new incident is assigned.
 * Auto-dismisses after 8 seconds or on click.
 */
export default function AlertBanner({
  incidents,
  onView,
}: {
  incidents: IncidentDoc[];
  onView: (id: string) => void;
}) {
  const [alertId, setAlertId] = useState<string | null>(null);
  const [seenIds] = useState(() => new Set<string>());

  // Watch for newly ASSIGNED incidents
  useEffect(() => {
    const assigned = incidents.find(
      (i) => i.status === "ASSIGNED" && !seenIds.has(i.id)
    );

    if (assigned) {
      seenIds.add(assigned.id);
      setAlertId(assigned.id);

      // Auto-dismiss after 8s
      const timer = setTimeout(() => setAlertId(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [incidents, seenIds]);

  if (!alertId) return null;

  const incident = incidents.find((i) => i.id === alertId);
  if (!incident) return null;

  return (
    <div className="animate-slide-down fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-danger px-6 py-3 shadow-lg">
      <div className="flex items-center gap-3">
        <Siren className="h-5 w-5 animate-pulse text-white" />
        <span className="text-sm font-black tracking-wide text-white">
          🚨 NEW EMERGENCY — {incident.name} — Room {incident.room} —{" "}
          {incident.type} ({incident.priority})
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            onView(alertId);
            setAlertId(null);
          }}
          className="rounded-lg bg-white/20 px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-white/30"
        >
          VIEW
        </button>
        <button
          onClick={() => setAlertId(null)}
          className="rounded-lg p-1.5 text-white/60 transition-colors hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
