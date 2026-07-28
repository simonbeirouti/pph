import { Skeleton } from "@/components/ui/skeleton"

export default function JobsLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading jobs"
      className="flex h-[calc(100dvh-6rem)] min-h-0 w-full flex-col overflow-hidden md:h-[calc(100dvh-8rem)]"
      role="status"
    >
      <div className="grid h-full min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-5 overflow-hidden">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="grid gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-5 w-80 max-w-full" />
          </div>
          <div className="grid w-full gap-3 sm:w-auto sm:justify-items-end">
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-9 w-full sm:w-44" />
              <Skeleton className="h-9 w-full sm:w-28" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-9 w-full sm:w-40" />
              <Skeleton className="h-9 w-full sm:w-48" />
            </div>
          </div>
        </div>

        <div className="grid min-h-0 grid-cols-1 gap-3 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, columnIndex) => (
            <section
              className={
                columnIndex === 0
                  ? "flex min-h-0 flex-col rounded-lg border bg-muted/30"
                  : "hidden min-h-0 flex-col rounded-lg border bg-muted/30 lg:flex"
              }
              key={columnIndex}
            >
              <div className="flex min-h-14 items-center gap-3 border-b px-3 py-2">
                <Skeleton className="size-8 rounded-full" />
                <div className="grid flex-1 gap-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-36" />
                </div>
                <Skeleton className="h-4 w-4" />
              </div>
              <div className="grid content-start gap-2 p-2">
                {Array.from({ length: 3 }, (_, cardIndex) => (
                  <div
                    className="grid gap-3 rounded-md border bg-background p-3"
                    key={cardIndex}
                  >
                    <Skeleton className="h-4 w-4/5" />
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-5 w-20" />
                    </div>
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
