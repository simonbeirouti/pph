import type { OfflineRepositoryState } from "@/lib/offline-v2/types"

export type DashboardViewSource = "cache" | "server"
export type NetworkReachability = "offline" | "online" | "unreachable"
export type MutationTransport = "outbox" | "server" | "unavailable"

export function selectDashboardViewSource({
  cachedShell,
  repositoryState,
  snapshotAvailable,
}: {
  cachedShell: boolean
  repositoryState: OfflineRepositoryState
  snapshotAvailable: boolean
}): DashboardViewSource {
  return cachedShell ||
    (snapshotAvailable &&
      (repositoryState === "ready" || repositoryState === "locked"))
    ? "cache"
    : "server"
}

export function selectMutationTransport({
  canQueueOfflineMutation,
  repositoryManaged,
  repositoryState,
}: {
  canQueueOfflineMutation: boolean
  repositoryManaged: boolean
  repositoryState: OfflineRepositoryState
}): MutationTransport {
  if (!repositoryManaged) return "server"
  if (repositoryState === "preparing") return "outbox"
  return canQueueOfflineMutation ? "outbox" : "unavailable"
}
