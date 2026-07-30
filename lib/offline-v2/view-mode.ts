import type { OfflineRepositorySyncState } from "@/lib/offline-v2/types"

export type DashboardViewSource = "cache" | "server"
export type NetworkReachability = "offline" | "online" | "unreachable"
export type MutationTransport = "outbox" | "server" | "unavailable"

export function selectDashboardViewSource({
  cachedShell,
  conflictCount,
  networkReachability,
  operationCount,
  syncState,
}: {
  cachedShell: boolean
  conflictCount: number
  networkReachability: NetworkReachability
  operationCount: number
  syncState: OfflineRepositorySyncState
}): DashboardViewSource {
  const hasLocalWork =
    operationCount > 0 ||
    conflictCount > 0 ||
    syncState === "needs_attention"
  return cachedShell || networkReachability !== "online" || hasLocalWork
    ? "cache"
    : "server"
}

export function selectMutationTransport({
  canQueueOfflineMutation,
  viewSource,
}: {
  canQueueOfflineMutation: boolean
  viewSource: DashboardViewSource
}): MutationTransport {
  if (viewSource === "server") return "server"
  return canQueueOfflineMutation ? "outbox" : "unavailable"
}
