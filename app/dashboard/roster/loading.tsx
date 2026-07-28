import { Skeleton } from "@/components/ui/skeleton"

export default function RosterLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading roster"
      className="flex h-[calc(100svh-7rem)] max-h-[calc(100svh-7rem)] min-h-0 w-full max-w-full min-w-0 flex-1 flex-col gap-4 overflow-hidden md:h-[calc(100svh-8rem)] md:max-h-[calc(100svh-8rem)]"
      role="status"
    >
      <div className="grid shrink-0 gap-3">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="grid gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-5 w-72 max-w-full" />
          </div>
          <Skeleton className="h-9 w-full sm:w-28" />
        </div>
        <div className="flex flex-col items-center justify-end gap-2 sm:flex-row">
          <Skeleton className="h-9 w-full sm:w-56" />
          <div className="grid w-full grid-cols-4 gap-2 sm:flex sm:w-auto">
            <Skeleton className="h-9" />
            <Skeleton className="col-span-2 h-9 sm:w-20" />
            <Skeleton className="h-9" />
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[4rem_minmax(0,1fr)] overflow-hidden rounded-xl border md:grid-cols-[4rem_repeat(7,minmax(8rem,1fr))]">
        <div className="border-r">
          <Skeleton className="m-2 h-5" />
          <div className="mt-4 grid gap-8 px-2">
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton className="h-3" key={index} />
            ))}
          </div>
        </div>
        {Array.from({ length: 7 }, (_, dayIndex) => (
          <div
            className={
              dayIndex === 0
                ? "min-w-0 border-r last:border-r-0"
                : "hidden min-w-0 border-r last:border-r-0 md:block"
            }
            key={dayIndex}
          >
            <div className="grid justify-items-center gap-2 border-b p-2">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-6 w-6 rounded-full" />
            </div>
            <div className="grid gap-8 px-2 pt-8">
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton className="h-12" key={index} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
