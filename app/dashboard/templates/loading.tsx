import { Skeleton } from "@/components/ui/skeleton"

export default function TemplatesLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading templates and schedules"
      className="grid gap-6"
      role="status"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-2">
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-9 min-w-0 flex-1 sm:w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            className="grid h-52 content-start gap-4 rounded-xl border p-4"
            key={index}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="grid flex-1 gap-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              <Skeleton className="size-8" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="mt-2 h-6 w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}
