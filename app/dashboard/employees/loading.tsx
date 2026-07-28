import { Skeleton } from "@/components/ui/skeleton"

export default function EmployeesLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading employees"
      className="flex w-full flex-col gap-6"
      role="status"
    >
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="grid gap-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-5 w-80 max-w-full" />
        </div>
        <Skeleton className="h-9 w-full sm:w-32" />
      </div>

      <div className="grid gap-4 rounded-xl border p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_12rem_auto]">
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
          <Skeleton className="h-8 sm:w-20" />
        </div>
        <div className="overflow-hidden rounded-lg border">
          <div className="hidden grid-cols-[2fr_1.2fr_1fr_1fr] gap-4 border-b p-3 sm:grid">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton className="h-4 w-20" key={index} />
            ))}
          </div>
          {Array.from({ length: 6 }, (_, index) => (
            <div
              className="flex items-center gap-3 border-b p-3 last:border-b-0 sm:grid sm:grid-cols-[2fr_1.2fr_1fr_1fr]"
              key={index}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <div className="grid min-w-0 flex-1 gap-2">
                  <Skeleton className="h-4 w-32 max-w-full" />
                  <Skeleton className="h-3 w-44 max-w-full" />
                </div>
              </div>
              <Skeleton className="hidden h-4 w-24 sm:block" />
              <Skeleton className="hidden h-5 w-16 sm:block" />
              <Skeleton className="hidden h-4 w-20 sm:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
