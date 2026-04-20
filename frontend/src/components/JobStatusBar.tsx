import { formatDuration } from "../utils/format";

interface Props {
  status: "idle" | "queued" | "running" | "completed" | "failed";
  elapsedMs: number;
  jobId: string | number | null;
}

export function JobStatusBar({ status, elapsedMs, jobId }: Props) {
  if (status === "idle") return null;

  return (
    <div className={`job-status ${status}`} role="status" aria-live="polite">
      <strong>{status.toUpperCase()}</strong>
      <span>Job #{jobId ?? "-"}</span>
      <span>Elapsed {formatDuration(elapsedMs)}</span>
    </div>
  );
}
