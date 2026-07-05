import { useEffect, useRef } from "react";
import type { IncidentDoc } from "../types";
import {
  assignNearestStaff,
  reassignStaleIncidents,
} from "../services/assignmentEngine";

/**
 * Auto-assignment hook.
 *
 * Watches the incident list for ACTIVE (unassigned) incidents and
 * triggers the assignment engine. Also periodically checks for
 * stale ASSIGNED incidents that timed out.
 *
 * Safe to run on multiple clients — Firestore transactions prevent
 * double-assignment.
 */
export function useAutoAssignment(
  incidents: IncidentDoc[],
  enabled: boolean
) {
  const assigningRef = useRef(new Set<string>());

  // ── Assign ACTIVE incidents ─────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;

    const activeIncidents = incidents.filter(
      (i) => i.status === "ACTIVE" && !assigningRef.current.has(i.id)
    );

    for (const incident of activeIncidents) {
      assigningRef.current.add(incident.id);

      void assignNearestStaff(incident.id).finally(() => {
        // Allow retry after a delay
        setTimeout(() => {
          assigningRef.current.delete(incident.id);
        }, 10_000);
      });
    }
  }, [incidents, enabled]);

  // ── Periodic reassignment check (every 15s) ─────────────────────────────
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      void reassignStaleIncidents(60_000);
    }, 15_000);

    return () => clearInterval(interval);
  }, [enabled]);
}
