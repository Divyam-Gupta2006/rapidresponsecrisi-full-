import { useCallback } from "react";
import {
  doc,
  increment,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";

/**
 * Incident action hooks — all use Firestore transactions for consistency.
 * Prevents race conditions (e.g., two staff accepting the same incident).
 */
export function useIncidentActions(staffUid: string | undefined) {
  /**
   * Accept an assigned incident.
   * Verifies: status === ASSIGNED && assignedTo === me
   */
  const acceptIncident = useCallback(
    async (incidentId: string) => {
      if (!staffUid) return;

      await runTransaction(db, async (txn) => {
        const ref = doc(db, "incidents", incidentId);
        const snap = await txn.get(ref);

        if (!snap.exists()) throw new Error("Incident not found");

        const data = snap.data();
        if (data.status !== "ASSIGNED" || data.assignedTo !== staffUid) {
          throw new Error(
            `Cannot accept: status=${data.status} assignedTo=${data.assignedTo}`
          );
        }

        txn.update(ref, {
          status: "ACCEPTED",
          acceptedAt: serverTimestamp(),
        });
      });

      console.log(`[Actions] ✅ accepted incident ${incidentId}`);
    },
    [staffUid]
  );

  /**
   * Mark that staff is en route to the incident.
   * Verifies: status === ACCEPTED && assignedTo === me
   */
  const goEnRoute = useCallback(
    async (incidentId: string) => {
      if (!staffUid) return;

      await runTransaction(db, async (txn) => {
        const ref = doc(db, "incidents", incidentId);
        const snap = await txn.get(ref);

        if (!snap.exists()) throw new Error("Incident not found");

        const data = snap.data();
        if (data.status !== "ACCEPTED" || data.assignedTo !== staffUid) {
          throw new Error(
            `Cannot go en route: status=${data.status} assignedTo=${data.assignedTo}`
          );
        }

        txn.update(ref, {
          status: "EN_ROUTE",
          enRouteAt: serverTimestamp(),
        });
      });

      console.log(`[Actions] 🚗 en route to incident ${incidentId}`);
    },
    [staffUid]
  );

  /**
   * Resolve an incident.
   * Verifies: assignedTo === me, status is ACCEPTED or EN_ROUTE
   * Also frees the staff member (status → AVAILABLE, clears activeIncidentId).
   */
  const resolveIncident = useCallback(
    async (incidentId: string) => {
      if (!staffUid) return;

      await runTransaction(db, async (txn) => {
        const incRef = doc(db, "incidents", incidentId);
        const incSnap = await txn.get(incRef);

        if (!incSnap.exists()) throw new Error("Incident not found");

        const data = incSnap.data();
        if (data.assignedTo !== staffUid) {
          throw new Error("Not assigned to you");
        }
        if (data.status !== "ACCEPTED" && data.status !== "EN_ROUTE") {
          throw new Error(`Cannot resolve from status=${data.status}`);
        }

        // Resolve incident
        txn.update(incRef, {
          status: "RESOLVED",
          resolvedAt: serverTimestamp(),
          resolvedBy: "staff",
        });

        // Free staff
        const staffRef = doc(db, "staff", staffUid);
        txn.update(staffRef, {
          status: "AVAILABLE",
          activeIncidentId: null,
          totalResolved: increment(1),
        });
      });

      console.log(`[Actions] ✅ resolved incident ${incidentId}`);
    },
    [staffUid]
  );

  return { acceptIncident, goEnRoute, resolveIncident };
}
