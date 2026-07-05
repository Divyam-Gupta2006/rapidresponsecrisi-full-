import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "../config/firebase";
import type { IncidentDoc, Incident } from "../types";

/**
 * Real-time listener for incidents assigned to the current staff member.
 * Also includes ACTIVE incidents (for awareness/auto-assign).
 */
export function useIncidents(staffUid: string | undefined) {
  const [incidents, setIncidents] = useState<IncidentDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!staffUid) {
      setIncidents([]);
      setLoading(false);
      return;
    }

    // Listen to incidents assigned to this staff member
    const q = query(
      collection(db, "incidents"),
      where("assignedTo", "==", staffUid),
      orderBy("timestamp", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs: IncidentDoc[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Incident),
        }));
        setIncidents(docs);
        setLoading(false);
      },
      (err) => {
        console.error("[useIncidents] listener error", err);
        setLoading(false);
      }
    );

    return unsub;
  }, [staffUid]);

  return { incidents, loading };
}

/**
 * Real-time listener for ALL active (unresolved) incidents.
 * Used by the auto-assignment system and for dashboard overview.
 */
export function useAllIncidents() {
  const [incidents, setIncidents] = useState<IncidentDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "incidents"),
      orderBy("timestamp", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs: IncidentDoc[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Incident),
        }));
        setIncidents(docs);
        setLoading(false);
      },
      (err) => {
        console.error("[useAllIncidents] listener error", err);
        setLoading(false);
      }
    );

    return unsub;
  }, []);

  return { incidents, loading };
}
