import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading dashboard"
      className="grid gap-6"
      role="status"
    >
      <div className="grid gap-2">
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            className="flex h-28 items-center justify-between rounded-xl border p-4"
            key={index}
          >
            <div className="grid gap-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-12" />
            </div>
            <Skeleton className="size-8 rounded-full" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        {Array.from({ length: 2 }, (_, panelIndex) => (
          <div
            className="grid h-[28rem] content-start gap-6 rounded-xl border p-4"
            key={panelIndex}
          >
            <div className="grid gap-2">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-4 w-64 max-w-full" />
            </div>
            <div className="grid gap-2">
              {Array.from({ length: 4 }, (_, rowIndex) => (
                <Skeleton className="h-16" key={rowIndex} />
              ))}
            </div>
          </div>
        ))}
        <div className="grid gap-6 rounded-xl border p-4 xl:col-span-2">
          <div className="flex items-center justify-between gap-4">
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-56 max-w-full" />
            </div>
            <Skeleton className="h-8 w-24" />
          </div>
          <div className="grid gap-2">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton className="h-16" key={index} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
