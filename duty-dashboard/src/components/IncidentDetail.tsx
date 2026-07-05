import { formatDistanceToNow } from "date-fns";
import {
  BrainCircuit,
  CheckCircle,
  Clock,
  MapPin,
  Mic,
  Navigation,
  Phone,
  Tag,
  User,
} from "lucide-react";
import type { IncidentDoc, Priority } from "../types";
import { PRIORITY_COLORS, TYPE_COLORS } from "../types";
import StatusTimeline from "./StatusTimeline";

const PRIORITY_BG: Record<Priority, string> = {
  HIGH: "bg-red-500",
  MEDIUM: "bg-amber-500",
  LOW: "bg-green-500",
};

export default function IncidentDetail({
  incident,
  onAccept,
  onEnRoute,
  onResolve,
}: {
  incident: IncidentDoc;
  onAccept: () => void;
  onEnRoute: () => void;
  onResolve: () => void;
}) {
  const ts = incident.timestamp?.toDate?.();
  const timeAgo = ts
    ? formatDistanceToNow(ts, { addSuffix: true })
    : "just now";

  const typeColor = TYPE_COLORS[incident.type] ?? "#6B7280";

  return (
    <div className="flex h-full flex-col">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="border-b border-border-dim px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border-dim"
              style={{ backgroundColor: typeColor + "20" }}
            >
              <User className="h-5 w-5" style={{ color: typeColor }} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {incident.name || "Anonymous Guest"}
              </h2>
              <p className="text-xs text-muted">
                Room {incident.room} · {timeAgo}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className="rounded-lg px-2.5 py-1 text-xs font-black text-white"
              style={{ backgroundColor: typeColor }}
            >
              {incident.type}
            </span>
            <span
              className={`rounded-lg px-2.5 py-1 text-xs font-black text-white ${
                PRIORITY_BG[incident.priority]
              }`}
            >
              {incident.priority}
            </span>
          </div>
        </div>
      </div>

      {/* ── Scrollable content ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Timeline */}
        <div className="rounded-2xl border border-border-dim bg-surface-2 p-4">
          <StatusTimeline incident={incident} />
        </div>

        {/* AI Analysis Box */}
        <div className="rounded-2xl border border-success/20 bg-success/5 p-5">
          <div className="mb-3 flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-success" />
            <span className="text-[10px] font-black tracking-widest text-success">
              AI SITUATION ANALYSIS
            </span>
          </div>

          {/* Transcript */}
          <div className="mb-3 flex items-start gap-2">
            <Mic className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted" />
            <p className="text-sm italic text-neutral-400 leading-relaxed">
              "{incident.transcript || "No audio transcript"}"
            </p>
          </div>

          {/* Summary */}
          <p className="mb-3 text-sm font-semibold text-white leading-relaxed">
            {incident.aiSummary || "Analyzing incident..."}
          </p>

          {/* Keywords */}
          {incident.keywords?.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Tag className="h-3 w-3 text-muted" />
              {incident.keywords.map((kw) => (
                <span
                  key={kw}
                  className="rounded-md bg-surface-3 px-2 py-0.5 text-[10px] font-bold text-muted"
                >
                  {kw}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Guest Details */}
        <div className="rounded-2xl border border-border-dim bg-surface-2 p-5">
          <h3 className="mb-3 text-[10px] font-black tracking-widest text-muted">
            GUEST INFORMATION
          </h3>

          <div className="space-y-2.5">
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted" />
              <span className="text-sm text-neutral-300">
                {incident.name || "Anonymous"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="h-4 w-4 text-muted" />
              <span className="text-sm text-neutral-300">
                Room {incident.room}
              </span>
            </div>
            {incident.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted" />
                <a
                  href={`tel:${incident.phone}`}
                  className="text-sm text-info underline"
                >
                  {incident.phone}
                </a>
              </div>
            )}
            {incident.eta && (
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted" />
                <span className="text-sm text-neutral-300">
                  ETA: {incident.eta}
                  {incident.distanceKm != null && (
                    <span className="ml-2 text-muted">
                      ({incident.distanceKm < 1
                        ? `${Math.round(incident.distanceKm * 1000)}m`
                        : `${incident.distanceKm.toFixed(1)}km`} away)
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Source */}
        <div className="flex items-center gap-3 text-xs text-muted">
          <span>Source: {incident.source?.toUpperCase()}</span>
          <span>·</span>
          <span>ID: {incident.id.slice(0, 8)}</span>
        </div>
      </div>

      {/* ── Action Buttons ──────────────────────────────────────── */}
      <div className="border-t border-border-dim p-4">
        {incident.status === "ASSIGNED" && (
          <button
            onClick={onAccept}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-success py-3.5 text-sm font-black text-black tracking-wider transition-opacity hover:opacity-90"
          >
            <CheckCircle className="h-5 w-5" />
            ACCEPT INCIDENT
          </button>
        )}

        {incident.status === "ACCEPTED" && (
          <button
            onClick={onEnRoute}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-info py-3.5 text-sm font-black text-white tracking-wider transition-opacity hover:opacity-90"
          >
            <Navigation className="h-5 w-5" />
            EN ROUTE
          </button>
        )}

        {incident.status === "EN_ROUTE" && (
          <button
            onClick={onResolve}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-success bg-success/10 py-3.5 text-sm font-black text-success tracking-wider transition-colors hover:bg-success/20"
          >
            <CheckCircle className="h-5 w-5" />
            MARK RESOLVED
          </button>
        )}

        {incident.status === "RESOLVED" && (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-success/10 py-3.5 text-sm font-bold text-success">
            <CheckCircle className="h-5 w-5" />
            RESOLVED
            {incident.resolvedBy && (
              <span className="text-muted ml-1">
                (by {incident.resolvedBy})
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
