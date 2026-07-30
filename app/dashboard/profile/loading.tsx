import { Skeleton } from "@/components/ui/skeleton"

export default function ProfileLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading profile"
      className="grid w-full max-w-7xl gap-6"
      role="status"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Skeleton className="size-16 shrink-0 rounded-full" />
          <Skeleton className="h-8 w-48 max-w-full" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>

      <div className="grid gap-6 rounded-xl border p-4">
        <div className="grid gap-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 2 }, (_, index) => (
              <div className="grid gap-2" key={index}>
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-9" />
              </div>
            ))}
          </div>
          {Array.from({ length: 3 }, (_, index) => (
            <div className="grid gap-2" key={index}>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9" />
            </div>
          ))}
          <div className="flex gap-3">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-36" />
          </div>
        </div>
      </div>
    </div>
  )
}
