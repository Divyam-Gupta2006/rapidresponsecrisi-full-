import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useAllIncidents } from "../hooks/useIncidents";
import { useIncidentActions } from "../hooks/useIncidentActions";
import { useStaffProfile } from "../hooks/useStaffProfile";
import { useAutoAssignment } from "../hooks/useAutoAssignment";
import Header from "../components/Header";
import IncidentFeed from "../components/IncidentFeed";
import IncidentDetail from "../components/IncidentDetail";
import AlertBanner from "../components/AlertBanner";
import { Shield } from "lucide-react";
import type { IncidentDoc } from "../types";

export default function DashboardPage() {
  const { staff } = useAuth();
  const { incidents, loading } = useAllIncidents();
  const { acceptIncident, goEnRoute, resolveIncident } = useIncidentActions(
    staff?.uid
  );
  const { updateLocation } = useStaffProfile(staff);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ── Filter incidents for this staff member ────────────────────────────
  const myIncidents = incidents.filter(
    (i) => i.assignedTo === staff?.uid
  );

  const activeCount = myIncidents.filter(
    (i) => i.status !== "RESOLVED"
  ).length;

  // ── Auto-assignment (runs on all connected dashboards, transaction-safe)
  useAutoAssignment(incidents, staff?.status === "AVAILABLE");

  // ── Auto-select first unresolved incident ─────────────────────────────
  useEffect(() => {
    if (selectedId) {
      const stillExists = myIncidents.find((i) => i.id === selectedId);
      if (stillExists) return;
    }

    const firstActive = myIncidents.find((i) => i.status !== "RESOLVED");
    if (firstActive) {
      setSelectedId(firstActive.id);
    }
  }, [myIncidents, selectedId]);

  // ── Geolocation tracking ──────────────────────────────────────────────
  useEffect(() => {
    if (!staff || !navigator.geolocation) return;

    let watchId: number;

    const startWatching = () => {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          void updateLocation(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => console.warn("[Geo] watchPosition error", err),
        { enableHighAccuracy: true, maximumAge: 10_000 }
      );
    };

    // Initial position
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void updateLocation(pos.coords.latitude, pos.coords.longitude);
        startWatching();
      },
      () => startWatching(), // Start watching even if initial fails
      { enableHighAccuracy: true }
    );

    return () => {
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
    };
  }, [staff, updateLocation]);

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleAccept = useCallback(
    async (id: string) => {
      try {
        await acceptIncident(id);
      } catch (err) {
        console.error("Accept failed", err);
      }
    },
    [acceptIncident]
  );

  const handleEnRoute = useCallback(
    async (id: string) => {
      try {
        await goEnRoute(id);
      } catch (err) {
        console.error("En Route failed", err);
      }
    },
    [goEnRoute]
  );

  const handleResolve = useCallback(
    async (id: string) => {
      try {
        await resolveIncident(id);
      } catch (err) {
        console.error("Resolve failed", err);
      }
    },
    [resolveIncident]
  );

  const selectedIncident: IncidentDoc | undefined = myIncidents.find(
    (i) => i.id === selectedId
  );

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#050505]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-danger border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[#050505]">
      {/* Alert Banner */}
      <AlertBanner
        incidents={myIncidents}
        onView={(id) => setSelectedId(id)}
      />

      {/* Header */}
      <Header activeCount={activeCount} />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel — Feed */}
        <div className="w-[380px] flex-shrink-0 border-r border-border-dim bg-surface">
          <IncidentFeed
            incidents={myIncidents}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>

        {/* Right Panel — Detail */}
        <div className="flex-1 bg-[#050505]">
          {selectedIncident ? (
            <IncidentDetail
              incident={selectedIncident}
              onAccept={() => handleAccept(selectedIncident.id)}
              onEnRoute={() => handleEnRoute(selectedIncident.id)}
              onResolve={() => handleResolve(selectedIncident.id)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-muted">
              <Shield className="mb-4 h-12 w-12 opacity-20" />
              <p className="text-lg font-bold">No incident selected</p>
              <p className="text-sm">
                {myIncidents.length === 0
                  ? "Set status to AVAILABLE to receive assignments"
                  : "Select an incident from the feed"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
