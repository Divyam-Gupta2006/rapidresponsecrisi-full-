/**
 * Assignment Engine — proximity-based staff assignment with Firestore transactions.
 *
 * Key guarantees:
 * - Only ONE staff can be assigned to an incident (transaction-safe)
 * - Staff must be AVAILABLE at the moment of assignment
 * - Incident must be ACTIVE at the moment of assignment
 * - Nearest staff is preferred (Haversine distance)
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "../config/firebase";
import type { Incident, StaffProfile } from "../types";
import {
  formatEta,
  getDistanceKm,
  estimateEtaMinutes,
} from "../utils/locationUtils";

interface RankedStaff {
  uid: string;
  name: string;
  phone: string;
  distanceKm: number;
  etaMinutes: number;
}

/**
 * Attempt to assign the nearest available staff to an ACTIVE incident.
 * Uses Firestore transactions to prevent race conditions.
 *
 * @returns true if assignment succeeded, false otherwise
 */
export async function assignNearestStaff(
  incidentId: string
): Promise<boolean> {
  // ── 1. Read incident (outside transaction to get location) ────────────
  const incidentRef = doc(db, "incidents", incidentId);
  const incidentSnap = await getDoc(incidentRef);

  if (!incidentSnap.exists()) {
    console.warn(`[Assignment] incident ${incidentId} not found`);
    return false;
  }

  const incident = incidentSnap.data() as Incident;
  if (incident.status !== "ACTIVE") {
    console.log(`[Assignment] incident ${incidentId} not ACTIVE (${incident.status})`);
    return false;
  }

  // ── 2. Query all AVAILABLE staff ──────────────────────────────────────
  const staffQuery = query(
    collection(db, "staff"),
    where("status", "==", "AVAILABLE")
  );
  const staffSnap = await getDocs(staffQuery);

  if (staffSnap.empty) {
    console.warn(`[Assignment] no available staff for incident ${incidentId}`);
    return false;
  }

  // ── 3. Rank by distance ───────────────────────────────────────────────
  const guestLoc = incident.guestLocation;
  const ranked: RankedStaff[] = staffSnap.docs
    .map((d) => {
      const data = d.data() as StaffProfile;
      let dist = 999;
      if (guestLoc && data.location) {
        dist = getDistanceKm(guestLoc, data.location);
      }
      return {
        uid: d.id,
        name: data.name,
        phone: data.phone,
        distanceKm: dist,
        etaMinutes: estimateEtaMinutes(dist),
      };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);

  // ── 4. Try assigning each candidate via transaction ───────────────────
  for (const candidate of ranked) {
    try {
      const success = await runTransaction(db, async (txn) => {
        const freshIncident = await txn.get(incidentRef);
        const staffRef = doc(db, "staff", candidate.uid);
        const freshStaff = await txn.get(staffRef);

        // Re-verify both documents are in valid state
        if (!freshIncident.exists() || freshIncident.data()?.status !== "ACTIVE") {
          return false;
        }
        if (!freshStaff.exists() || freshStaff.data()?.status !== "AVAILABLE") {
          return false;
        }

        // Atomically assign
        txn.update(incidentRef, {
          status: "ASSIGNED",
          assignedTo: candidate.uid,
          assignedName: candidate.name,
          assignedPhone: candidate.phone,
          distanceKm: Math.round(candidate.distanceKm * 100) / 100,
          eta: formatEta(candidate.etaMinutes),
          assignedAt: serverTimestamp(),
        });

        txn.update(staffRef, {
          status: "BUSY",
          activeIncidentId: incidentId,
        });

        return true;
      });

      if (success) {
        console.log(
          `[Assignment] ✅ assigned ${candidate.name} to ${incidentId} (${candidate.distanceKm.toFixed(2)} km)`
        );
        return true;
      }
    } catch (err) {
      console.warn(
        `[Assignment] transaction failed for ${candidate.uid}, trying next`,
        err
      );
    }
  }

  console.warn(`[Assignment] exhausted all candidates for ${incidentId}`);
  return false;
}

/**
 * Check for ASSIGNED incidents that have timed out (staff didn't accept).
 * Reverts them to ACTIVE and frees the staff member.
 */
export async function reassignStaleIncidents(
  timeoutMs: number = 60_000
): Promise<void> {
  const q = query(
    collection(db, "incidents"),
    where("status", "==", "ASSIGNED")
  );
  const snap = await getDocs(q);

  const now = Date.now();

  for (const d of snap.docs) {
    const data = d.data() as Incident;
    const assignedAt = data.assignedAt?.toMillis?.() ?? 0;

    if (assignedAt > 0 && now - assignedAt > timeoutMs) {
      console.log(`[Assignment] ⏱ incident ${d.id} timed out, reverting to ACTIVE`);

      try {
        await runTransaction(db, async (txn) => {
          const freshIncident = await txn.get(d.ref);
          if (freshIncident.data()?.status !== "ASSIGNED") return;

          const staffId = freshIncident.data()?.assignedTo;

          // Revert incident to ACTIVE
          txn.update(d.ref, {
            status: "ACTIVE",
            assignedTo: null,
            assignedName: null,
            assignedPhone: null,
            distanceKm: null,
            eta: null,
            assignedAt: null,
          });

          // Free the staff member
          if (staffId) {
            const staffRef = doc(db, "staff", staffId);
            const freshStaff = await txn.get(staffRef);
            if (freshStaff.exists() && freshStaff.data()?.activeIncidentId === d.id) {
              txn.update(staffRef, {
                status: "AVAILABLE",
                activeIncidentId: null,
              });
            }
          }
        });
      } catch (err) {
        console.error(`[Assignment] reassignment transaction failed for ${d.id}`, err);
      }
    }
  }
}
