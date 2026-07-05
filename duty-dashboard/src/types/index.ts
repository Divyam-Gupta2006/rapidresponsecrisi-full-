import type { Timestamp } from "firebase/firestore";

// ── Incident Lifecycle ──────────────────────────────────────────────────────

export type IncidentStatus =
  | "ACTIVE"
  | "ASSIGNED"
  | "ACCEPTED"
  | "EN_ROUTE"
  | "RESOLVED";

export const INCIDENT_STATUS_ORDER: Record<IncidentStatus, number> = {
  ACTIVE: 0,
  ASSIGNED: 1,
  ACCEPTED: 2,
  EN_ROUTE: 3,
  RESOLVED: 4,
};

// ── Emergency Classification ────────────────────────────────────────────────

export type EmergencyType = "FIRE" | "MEDICAL" | "SECURITY" | "PANIC" | "OTHER";

export type Priority = "HIGH" | "MEDIUM" | "LOW";

export const PRIORITY_COLORS: Record<Priority, string> = {
  HIGH: "#EF4444",
  MEDIUM: "#F59E0B",
  LOW: "#4ADE80",
};

export const TYPE_COLORS: Record<EmergencyType, string> = {
  FIRE: "#EF4444",
  MEDICAL: "#3B82F6",
  SECURITY: "#A855F7",
  PANIC: "#F59E0B",
  OTHER: "#6B7280",
};

// ── Geo ─────────────────────────────────────────────────────────────────────

export interface GeoLocation {
  lat: number;
  lng: number;
}

// ── Staff ───────────────────────────────────────────────────────────────────

export type StaffStatus = "AVAILABLE" | "BUSY" | "OFFLINE";

export type StaffRole = "security" | "medical" | "fire" | "general";

export interface StaffProfile {
  name: string;
  email: string;
  phone: string;
  role: StaffRole;
  status: StaffStatus;
  location: GeoLocation | null;
  locationUpdatedAt: Timestamp | null;
  activeIncidentId: string | null;
  totalResolved: number;
  lastSeen: Timestamp | null;
  createdAt: Timestamp;
}

/** StaffProfile with the Firestore document id attached */
export interface StaffDoc extends StaffProfile {
  uid: string;
}

// ── Incident ────────────────────────────────────────────────────────────────

export interface Incident {
  guestId: string;
  name: string;
  room: string;
  phone: string;
  guestLocation: GeoLocation | null;
  transcript: string;
  aiSummary: string;
  type: EmergencyType;
  priority: Priority;
  keywords: string[];
  source: string;
  status: IncidentStatus;
  assignedTo: string | null;
  assignedName: string | null;
  assignedPhone: string | null;
  distanceKm: number | null;
  eta: string | null;
  assignedAt: Timestamp | null;
  acceptedAt: Timestamp | null;
  enRouteAt: Timestamp | null;
  resolvedAt: Timestamp | null;
  resolvedBy: "staff" | "guest" | null;
  timestamp: Timestamp;
}

/** Incident with the Firestore document id attached */
export interface IncidentDoc extends Incident {
  id: string;
}
