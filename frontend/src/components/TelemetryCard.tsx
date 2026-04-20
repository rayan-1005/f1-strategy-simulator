import type { PropsWithChildren } from "react";

interface Props extends PropsWithChildren {
  title?: string;
  kicker?: string;
}

export function TelemetryCard({ title, kicker, children }: Props) {
  return (
    <article className="telemetry-card">
      {kicker ? <div className="card-kicker">{kicker}</div> : null}
      {title ? <h3 className="card-title">{title}</h3> : null}
      {children}
    </article>
  );
}
