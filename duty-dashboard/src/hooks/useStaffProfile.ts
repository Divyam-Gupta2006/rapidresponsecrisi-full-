import { useCallback } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase";
import type { StaffDoc } from "../types";

/**
 * Hook providing staff profile actions — status toggle & location updates.
 */
export function useStaffProfile(staff: StaffDoc | null) {
  const updateStatus = useCallback(
    async (newStatus: "AVAILABLE" | "BUSY" | "OFFLINE") => {
      if (!staff) return;
      await updateDoc(doc(db, "staff", staff.uid), {
        status: newStatus,
        lastSeen: serverTimestamp(),
      });
    },
    [staff]
  );

  const updateLocation = useCallback(
    async (lat: number, lng: number) => {
      if (!staff) return;
      await updateDoc(doc(db, "staff", staff.uid), {
        location: { lat, lng },
        locationUpdatedAt: serverTimestamp(),
        lastSeen: serverTimestamp(),
      });
    },
    [staff]
  );

  return { updateStatus, updateLocation };
}
