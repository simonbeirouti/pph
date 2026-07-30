import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading dashboard"
      className="grid gap-8"
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
          <section
            className="flex h-[28rem] min-h-0 flex-col"
            data-dashboard-loading-section
            key={panelIndex}
          >
            <div className="grid gap-2">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-4 w-64 max-w-full" />
            </div>
            <div className="mt-6 grid gap-2">
              {Array.from({ length: 4 }, (_, rowIndex) => (
                <div
                  className="flex h-16 items-center justify-between gap-3 rounded-lg border p-3"
                  key={rowIndex}
                >
                  <div className="grid flex-1 gap-2">
                    <Skeleton className="h-4 w-2/3 max-w-48" />
                    <Skeleton className="h-3 w-1/2 max-w-32" />
                  </div>
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
          </section>
        ))}
        <section
          className="xl:col-span-2"
          data-dashboard-loading-section
        >
          <div className="flex items-center justify-between gap-4">
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-56 max-w-full" />
            </div>
            <Skeleton className="h-8 w-24" />
          </div>
          <div className="mt-6 grid gap-2">
            {Array.from({ length: 3 }, (_, index) => (
              <div
                className="flex h-16 items-center justify-between gap-3 rounded-lg border p-3"
                key={index}
              >
                <div className="grid flex-1 gap-2">
                  <Skeleton className="h-4 w-40 max-w-2/3" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-5 w-20" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
