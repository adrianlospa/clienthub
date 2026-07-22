export default function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="animate-pulse">
      <div className="h-7 w-48 rounded bg-paper" />
      <div className="mt-6 rounded-lg border border-line bg-surface p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line py-3 last:border-0">
            <div className="h-4 w-1/3 rounded bg-paper" />
            <div className="h-4 w-1/5 rounded bg-paper" />
            <div className="ml-auto h-4 w-16 rounded bg-paper" />
          </div>
        ))}
      </div>
    </div>
  )
}
