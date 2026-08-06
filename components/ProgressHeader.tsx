"use client";

interface ProgressHeaderProps {
  total: number;
  completed: number;
  failed: number;
  cancelled: boolean;
  reconnecting: boolean;
  onCancel: () => void;
  onResume: () => void;
  showResume: boolean;
}

export default function ProgressHeader({
  total,
  completed,
  failed,
  cancelled,
  reconnecting,
  onCancel,
  onResume,
  showResume,
}: ProgressHeaderProps) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-3" role="status" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] font-mono text-[var(--text)]">
          {cancelled
            ? `Cancelled — ${completed} of ${total} processed`
            : `Processing ${completed} of ${total}${failed > 0 ? ` · ${failed} failed` : ""}`}
          {reconnecting && !cancelled ? <span className="text-[var(--text-muted)]"> · Reconnecting…</span> : null}
        </p>
        <div className="flex items-center gap-3">
          {showResume ? (
            <button type="button" className="btn-secondary" onClick={onResume}>
              Still processing — resume polling
            </button>
          ) : null}
          {!cancelled ? (
            <button type="button" className="btn-secondary" onClick={onCancel}>
              Cancel
            </button>
          ) : null}
        </div>
      </div>
      <div className="h-[2px] w-full bg-[var(--border)]">
        <div
          className="h-full bg-[var(--text)] motion-reduce:transition-none"
          style={{ width: `${pct}%`, transition: "width 300ms linear" }}
        />
      </div>
    </div>
  );
}
