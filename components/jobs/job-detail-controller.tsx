"use client"

import Link from "next/link"
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react"
import { toast } from "sonner"

import { useOptionalRealtimeInvalidations } from "@/components/dashboard/dashboard-realtime-provider"
import {
  EmployeeJobDetail,
  JobDetailLoading,
  OwnerJobDetail,
} from "@/components/jobs/job-detail"
import { useOptionalOfflineV2 } from "@/components/offline/offline-v2-provider"
import { cacheOfflineSnapshotMedia } from "@/lib/offline-v2/storage"
import type { JobBoardEmployee, JobCard, JobDetail } from "@/lib/jobs/types"

const JOB_DETAIL_REALTIME_DOMAINS = [
  "job",
  "job_update",
  "evidence",
  "review",
] as const
const JOB_DETAIL_REALTIME_DEBOUNCE_MS = 75

type DetailRole = "employee" | "owner"

type JobDetailNavigation = {
  openJob: (job: JobCard) => void
}

const JobDetailNavigationContext = createContext<JobDetailNavigation | null>(
  null
)

export function useJobDetailNavigation() {
  return useContext(JobDetailNavigationContext)
}

export function JobDetailController({
  children,
  employees,
  initialDetail,
  isOwner,
  jobs,
  role,
  timezone,
}: {
  children: ReactNode
  employees: readonly JobBoardEmployee[]
  initialDetail: JobDetail | null
  isOwner: boolean
  jobs: readonly JobCard[]
  role: DetailRole
  timezone: string
}) {
  const offline = useOptionalOfflineV2()
  const initialId = initialDetail?.id ?? null
  const [selectedId, setSelectedId] = useState<number | null>(initialId)
  const [detail, setDetail] = useState<JobDetail | null>(initialDetail)
  const [lastInitialDetail, setLastInitialDetail] = useState<JobDetail | null>(
    initialDetail
  )
  const [loading, setLoading] = useState(false)
  const [retryJobId, setRetryJobId] = useState<number | null>(null)
  const detailRef = useRef(detail)
  const selectedIdRef = useRef(selectedId)
  const requestRef = useRef<AbortController | null>(null)
  const realtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const jobById = useMemo(
    () => new Map(jobs.map((job) => [job.id, job])),
    [jobs]
  )

  if (initialDetail !== lastInitialDetail) {
    setLastInitialDetail(initialDetail)
    setSelectedId(initialId)
    setDetail(initialDetail)
    setLoading(false)
    setRetryJobId(null)
  }

  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

  useEffect(() => {
    detailRef.current = detail
  }, [detail])

  useEffect(() => {
    requestRef.current?.abort()
    requestRef.current = null
    selectedIdRef.current = initialId
    detailRef.current = initialDetail
  }, [initialDetail, initialId])

  const replaceSnapshotDetail = useCallback(
    async (nextDetail: JobDetail) => {
      if (!offline?.snapshot || !offline.updateSnapshot) return
      const hasPendingJobOperation = offline.operations.some(
        (operation) =>
          operation.entityType === "job" &&
          operation.entity.source === "server" &&
          operation.entity.id === nextDetail.id
      )
      if (hasPendingJobOperation) return
      await offline.updateSnapshot((snapshot) => ({
        ...snapshot,
        jobDetails: { ...snapshot.jobDetails, [nextDetail.id]: nextDetail },
      }))
      void cacheOfflineSnapshotMedia(
        {
          ...offline.snapshot,
          jobDetails: {
            ...offline.snapshot.jobDetails,
            [nextDetail.id]: nextDetail,
          },
        },
        [nextDetail.id]
      )
    },
    [offline]
  )

  const refresh = useCallback(
    async (jobId: number) => {
      requestRef.current?.abort()
      const controller = new AbortController()
      requestRef.current = controller
      try {
        const response = await fetch(`/api/jobs/${jobId}`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? "Job is unavailable."
              : "Unable to refresh the job."
          )
        }
        const nextDetail = (await response.json()) as JobDetail
        if (selectedIdRef.current !== jobId) return
        setDetail(nextDetail)
        setLoading(false)
        setRetryJobId(null)
        await replaceSnapshotDetail(nextDetail)
      } catch {
        if (controller.signal.aborted || selectedIdRef.current !== jobId) return
        setLoading(false)
        if (!detailRef.current) {
          toast.error("Could not refresh this job. Try again when connected.")
          return
        }
        setRetryJobId(jobId)
        toast.error(
          "Showing saved job details. The latest version could not load."
        )
      }
    },
    [replaceSnapshotDetail]
  )

  const selectJob = useCallback(
    (jobId: number, history: "push" | "none") => {
      const job = jobById.get(jobId)
      const cached =
        offline?.snapshot?.jobDetails[jobId] ??
        (initialDetail?.id === jobId ? initialDetail : null)
      if (history === "push") {
        const params = new URLSearchParams(window.location.search)
        params.set("job", String(jobId))
        window.history.pushState(
          null,
          "",
          `${window.location.pathname}?${params.toString()}`
        )
      }
      selectedIdRef.current = jobId
      setSelectedId(jobId)
      setDetail(cached)
      detailRef.current = cached
      setLoading(!cached)
      setRetryJobId(null)
      if (navigator.onLine && !offline?.usesLocalRepository) {
        void refresh(jobId)
      }
      if (!cached && !job) {
        toast.error("This job is no longer available.")
      }
    },
    [
      initialDetail,
      jobById,
      offline?.snapshot?.jobDetails,
      offline?.usesLocalRepository,
      refresh,
    ]
  )

  const openJob = useCallback(
    (job: JobCard) => selectJob(job.id, "push"),
    [selectJob]
  )

  const refreshSelectedDetail = useCallback(async () => {
    const jobId = selectedIdRef.current
    if (!jobId || !navigator.onLine || offline?.usesLocalRepository) return
    await refresh(jobId)
  }, [offline?.usesLocalRepository, refresh])

  const onRealtimeInvalidation = useCallback(
    (event: { entityId: number }) => {
      if (
        event.entityId === selectedIdRef.current &&
        navigator.onLine &&
        selectedIdRef.current
      ) {
        if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current)
        const jobId = selectedIdRef.current
        realtimeTimerRef.current = setTimeout(() => {
          realtimeTimerRef.current = null
          void refresh(jobId)
        }, JOB_DETAIL_REALTIME_DEBOUNCE_MS)
      }
    },
    [refresh]
  )
  useOptionalRealtimeInvalidations(
    JOB_DETAIL_REALTIME_DOMAINS,
    onRealtimeInvalidation
  )

  const close = useCallback(() => {
    requestRef.current?.abort()
    requestRef.current = null
    const params = new URLSearchParams(window.location.search)
    params.delete("job")
    const query = params.toString()
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}`
    )
    selectedIdRef.current = null
    setSelectedId(null)
    detailRef.current = null
    setLoading(false)
    setRetryJobId(null)
  }, [])

  useEffect(() => {
    const onPopState = () => {
      const rawJobId = new URLSearchParams(window.location.search).get("job")
      const jobId = rawJobId && /^\d+$/.test(rawJobId) ? Number(rawJobId) : null
      if (!jobId || !Number.isSafeInteger(jobId)) {
        selectedIdRef.current = null
        setSelectedId(null)
        detailRef.current = null
        setLoading(false)
        setRetryJobId(null)
        return
      }
      selectJob(jobId, "none")
    }
    window.addEventListener("popstate", onPopState)
    return () => {
      requestRef.current?.abort()
      if (realtimeTimerRef.current) clearTimeout(realtimeTimerRef.current)
      window.removeEventListener("popstate", onPopState)
    }
  }, [selectJob])

  const open = selectedId !== null
  const selectedJob = selectedId ? jobById.get(selectedId) : null
  const title = detail?.title ?? selectedJob?.title ?? "Job"
  const value = useMemo(() => ({ openJob }), [openJob])

  return (
    <JobDetailNavigationContext.Provider value={value}>
      {children}
      {detail ? (
        role === "employee" ? (
          <EmployeeJobDetail
            detail={detail}
            onClose={close}
            onMutationSuccess={refreshSelectedDetail}
            open={open}
            timezone={timezone}
          />
        ) : (
          <OwnerJobDetail
            canReview={isOwner || detail.requiredReviewerRole === "manager"}
            detail={detail}
            employees={employees}
            onClose={close}
            onMutationSuccess={refreshSelectedDetail}
            open={open}
            timezone={timezone}
          />
        )
      ) : open && loading ? (
        <JobDetailLoading onClose={close} open role={role} title={title} />
      ) : null}
      {retryJobId !== null && retryJobId === selectedId ? (
        <button
          className="fixed right-4 bottom-4 z-50 rounded-md bg-background px-3 py-2 text-sm font-medium shadow-lg ring-1 ring-border"
          onClick={() => void refresh(retryJobId)}
          type="button"
        >
          Retry job refresh
        </button>
      ) : null}
    </JobDetailNavigationContext.Provider>
  )
}

type OpenJobLinkProps = Omit<
  ComponentPropsWithoutRef<typeof Link>,
  "href" | "prefetch"
> & {
  href: string
  job: JobCard
}

export const OpenJobLink = forwardRef<HTMLAnchorElement, OpenJobLinkProps>(
  function OpenJobLink({ children, href, job, onNavigate, ...linkProps }, ref) {
    const navigation = useJobDetailNavigation()
    const offline = useOptionalOfflineV2()
    return (
      <Link
        {...linkProps}
        href={href}
        ref={ref}
        onNavigate={(event) => {
          if (!navigation || offline?.usesLocalRepository) {
            onNavigate?.(event)
            return
          }
          event.preventDefault()
          navigation.openJob(job)
        }}
        prefetch={false}
      >
        {children}
      </Link>
    )
  }
)
