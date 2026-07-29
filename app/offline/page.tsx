import { OfflineEntry } from "@/components/offline-entry"

export default function OfflinePage() {
  return (
    <main className="mx-auto grid min-h-svh w-full max-w-3xl gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Employee Ops</h1>
      </div>
      <OfflineEntry />
    </main>
  )
}
