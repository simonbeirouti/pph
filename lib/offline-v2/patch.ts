import type {
  OfflineV2Patch,
  OfflineV2Snapshot,
} from "@/lib/offline-v2/types"

export function applyOfflineV2Patch(
  snapshot: OfflineV2Snapshot,
  patch: OfflineV2Patch
): OfflineV2Snapshot {
  if (patch.baseRevision !== snapshot.revision) {
    throw new Error("Offline patch revision does not match the local snapshot")
  }
  return {
    ...snapshot,
    ...(patch.dashboard !== undefined
      ? { dashboard: patch.dashboard }
      : {}),
    ...(patch.employeeJobs !== undefined
      ? { employeeJobs: patch.employeeJobs }
      : {}),
    ...(patch.jobDetails !== undefined
      ? { jobDetails: patch.jobDetails }
      : {}),
    ...(patch.jobs !== undefined ? { jobs: patch.jobs } : {}),
    ...(patch.membership !== undefined
      ? { membership: patch.membership }
      : {}),
    ...(patch.people !== undefined ? { people: patch.people } : {}),
    ...(patch.profile !== undefined ? { profile: patch.profile } : {}),
    ...(patch.roster !== undefined ? { roster: patch.roster } : {}),
    ...(patch.templates !== undefined ? { templates: patch.templates } : {}),
    leaseExpiresAt: patch.leaseExpiresAt,
    refreshedAt: patch.refreshedAt,
    revision: patch.revision,
  }
}
