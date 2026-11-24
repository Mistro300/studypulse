export function RouteSkeleton() {
  return (
    <div className="space-y-4">
      <div className="sp-card animate-pulse space-y-3 p-6">
        <div className="h-6 w-1/3 rounded bg-surface-subtle" />
        <div className="h-4 w-2/3 rounded bg-surface-subtle" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sp-card h-32 animate-pulse p-5" />
        <div className="sp-card h-32 animate-pulse p-5" />
      </div>
    </div>
  );
}
