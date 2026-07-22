export default function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="animate-pulse">
      <div className="h-7 w-48 rounded bg-slate-200" />
      <div className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-slate-100 py-3 last:border-0">
            <div className="h-4 w-1/3 rounded bg-slate-200" />
            <div className="h-4 w-1/5 rounded bg-slate-100" />
            <div className="ml-auto h-4 w-16 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  )
}
