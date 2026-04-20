export function LoadingSkeleton() {
  return (
    <div className="skeleton-wrap" aria-label="Loading">
      <div className="skeleton-line w-70" />
      <div className="skeleton-line w-40" />
      <div className="skeleton-chart" />
    </div>
  );
}
