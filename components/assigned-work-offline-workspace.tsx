"use client"

import * as tus from "tus-js-client"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { CameraIcon, LoaderCircleIcon } from "lucide-react"
import Link from "next/link"
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react"
import { toast } from "sonner"

import {
  prepareOfflineEvidenceUploadAction,
  refreshOfflineSessionAction,
  replayOfflineJobOperationAction,
} from "@/app/dashboard/jobs/offline-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { assignedWorkQueryKey } from "@/lib/offline/query"
import {
  canStorePhoto,
  getOperations,
  getPhoto,
  hasOfflineConsent,
  putOperation,
  putPhoto,
  removeOperation,
  setOfflineConsent,
} from "@/lib/offline/storage"
import type {
  OfflineJob,
  OfflineOperation,
  OfflineWorkPack,
} from "@/lib/offline/types"
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/browser"
import { getBrowserSupabasePublicConfig } from "@/lib/supabase/public-env"
import {
  detectImageMimeType,
  extensionForImageMimeType,
  mimeTypeForImageUpload,
  type SupportedImageMimeType,
} from "@/lib/uploads/image"

const SYNC_PROBE_INTERVAL_MS = 5_000

export function AssignedWorkOfflineWorkspace({
  fallback,
  initialPack,
  initiallyOffline = false,
  selectedJobId,
}: {
  fallback: ReactNode
  initialPack: OfflineWorkPack
  initiallyOffline?: boolean
  selectedJobId: number | null
}) {
  const queryClient = useQueryClient()
  const queryKey = assignedWorkQueryKey(initialPack.identity)
  const { data: pack } = useQuery({
    initialData: initialPack,
    meta: { offlineWorkPack: true },
    networkMode: "always",
    queryFn: async () => initialPack,
    queryKey,
    staleTime: Infinity,
  })
  const [consent, setConsent] = useState<boolean | null>(null)
  const [operations, setOperations] = useState<OfflineOperation[]>([])
  const browserOnlineRef = useRef(
    !initiallyOffline &&
      (typeof navigator === "undefined" ? true : navigator.onLine)
  )
  const syncingRef = useRef(false)
  const syncRef = useRef<() => Promise<void>>(async () => {})

  const refreshOperations = useCallback(async () => {
    setOperations(await getOperations())
  }, [])

  const updatePack = useCallback(
    (updater: (current: OfflineWorkPack) => OfflineWorkPack) => {
      queryClient.setQueryData<OfflineWorkPack>(queryKey, (current) =>
        updater(current ?? initialPack)
      )
    },
    [initialPack, queryClient, queryKey]
  )

  const uploadPhoto = useCallback(async (operation: OfflineOperation) => {
    const blob = await getPhoto(operation.clientOperationId)
    if (!blob)
      throw new Error("The pending photo is unavailable on this device.")
    const mimeType = String(
      operation.payload.mimeType
    ) as SupportedImageMimeType
    const extension = extensionForImageMimeType(mimeType)
    const prepared = await prepareOfflineEvidenceUploadAction({
      clientOperationId: operation.clientOperationId,
      extension,
      jobId: operation.jobId,
    })
    if (!prepared.ok) throw new Error(prepared.message)
    const endpoint = `${getBrowserSupabasePublicConfig().url}/storage/v1/upload/resumable`
    const uploadHost = new URL(endpoint).hostname
    const headers: Record<string, string> = {
      "x-signature": prepared.signature,
    }
    if (uploadHost === "127.0.0.1" || uploadHost === "localhost") {
      const {
        data: { session },
      } = await createBrowserSupabaseClient().auth.getSession()
      if (!session)
        throw new Error("Your session expired before the photo upload.")
      delete headers["x-signature"]
      headers.authorization = `Bearer ${session.access_token}`
    }

    await new Promise<void>((resolve, reject) => {
      const upload = new tus.Upload(blob, {
        chunkSize: 6 * 1024 * 1024,
        endpoint,
        headers,
        metadata: {
          bucketName: prepared.bucketName,
          cacheControl: "3600",
          contentType: mimeType,
          objectName: prepared.objectName,
        },
        onError: reject,
        onSuccess: () => resolve(),
        removeFingerprintOnSuccess: true,
        retryDelays: [0, 1000, 3000, 5000],
        uploadDataDuringCreation: true,
      })
      void upload.findPreviousUploads().then((previous) => {
        if (previous[0]) upload.resumeFromPreviousUpload(previous[0])
        upload.start()
      }, reject)
    })
    return prepared.objectName
  }, [])

  const sync = useCallback(async () => {
    if (syncingRef.current || !browserOnlineRef.current || !navigator.onLine)
      return
    syncingRef.current = true
    try {
      const identity = await refreshOfflineSessionAction()
      if (
        identity.membershipId !== pack.identity.membershipId ||
        identity.organisationId !== pack.identity.organisationId
      ) {
        throw new Error(
          "Your active membership changed. Local work was not replayed."
        )
      }

      const queued = (await getOperations()).filter(
        (operation) => operation.state !== "needs_attention"
      )
      const currentVersions = new Map<number, number>()
      for (const job of pack.jobs) currentVersions.set(job.id, job.version)

      for (const operation of queued) {
        const remaining = await getOperations()
        if (
          operation.dependsOn.some((dependency) =>
            remaining.some(
              (candidate) => candidate.clientOperationId === dependency
            )
          )
        ) {
          continue
        }
        const syncingOperation = {
          ...operation,
          expectedVersion:
            currentVersions.get(operation.jobId) ?? operation.expectedVersion,
          state: "syncing" as const,
        }
        await putOperation(syncingOperation)
        await refreshOperations()

        try {
          const payload = { ...syncingOperation.payload }
          if (syncingOperation.kind === "photo") {
            payload.storagePath = await uploadPhoto(syncingOperation)
          }
          const response = await replayOfflineJobOperationAction({
            ...syncingOperation,
            payload,
          })
          if (!response.ok) throw new Error(response.message)
          const { replay } = response
          if (replay.operation_status !== "acknowledged") {
            await putOperation({
              ...syncingOperation,
              lastError:
                replay.result.reason === "version_conflict"
                  ? "This job changed on the server. Review your local work."
                  : "This job is no longer editable.",
              state: "needs_attention",
            })
            continue
          }

          currentVersions.set(operation.jobId, replay.job_version)
          updatePack((current) => ({
            ...current,
            jobs: current.jobs.map((job) =>
              job.id === operation.jobId
                ? acknowledgeOperation(
                    job,
                    operation,
                    replay.job_version,
                    replay.result
                  )
                : job
            ),
            refreshedAt: new Date().toISOString(),
          }))
          await removeOperation(operation.clientOperationId)
        } catch (syncError) {
          await putOperation({
            ...syncingOperation,
            lastError:
              syncError instanceof Error
                ? syncError.message
                : "The queued change could not sync.",
            state:
              browserOnlineRef.current && navigator.onLine
                ? "failed"
                : "pending",
          })
          if (!browserOnlineRef.current || !navigator.onLine) break
        }
      }
    } catch (syncError) {
      const message =
        syncError instanceof Error
          ? syncError.message
          : "The queued change could not sync."
      const queued = await getOperations()
      await Promise.all(
        queued
          .filter((operation) => operation.state !== "needs_attention")
          .map((operation) =>
            putOperation({
              ...operation,
              lastError: message,
              state:
                browserOnlineRef.current && navigator.onLine
                  ? "failed"
                  : "pending",
            })
          )
      )
    } finally {
      syncingRef.current = false
      await refreshOperations()
    }
  }, [
    pack.identity.membershipId,
    pack.identity.organisationId,
    pack.jobs,
    refreshOperations,
    updatePack,
    uploadPhoto,
  ])

  useEffect(() => {
    syncRef.current = sync
  }, [sync])

  const probeAndSync = useCallback(async () => {
    if (!navigator.onLine) return
    try {
      const response = await fetch("/manifest.webmanifest", {
        cache: "no-store",
        method: "HEAD",
      })
      if (response.ok) {
        browserOnlineRef.current = true
        await syncRef.current()
      }
    } catch {
      // The next focus, online event, or interval will probe again.
    }
  }, [])

  useEffect(() => {
    let active = true
    void Promise.all([hasOfflineConsent(), getOperations()]).then(
      ([storedConsent, storedOperations]) => {
        if (!active) return
        setConsent(storedConsent)
        setOperations(storedOperations)
      }
    )
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (
      navigator.onLine &&
      operations.length === 0 &&
      new Date(initialPack.refreshedAt).getTime() >
        new Date(pack.refreshedAt).getTime()
    ) {
      queryClient.setQueryData(queryKey, initialPack)
    }
  }, [initialPack, operations.length, pack.refreshedAt, queryClient, queryKey])

  useEffect(() => {
    const handleOnline = () => {
      browserOnlineRef.current = true
      void probeAndSync()
    }
    const handleOffline = () => {
      browserOnlineRef.current = false
    }
    const handleFocus = () => void probeAndSync()
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    window.addEventListener("focus", handleFocus)
    if (consent) queueMicrotask(() => void probeAndSync())
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      window.removeEventListener("focus", handleFocus)
    }
  }, [consent, probeAndSync])

  const retryableOperationCount = operations.filter(
    (operation) => operation.state !== "needs_attention"
  ).length
  useEffect(() => {
    if (!consent || retryableOperationCount === 0) return
    const timer = window.setInterval(
      () => void probeAndSync(),
      SYNC_PROBE_INTERVAL_MS
    )
    return () => window.clearInterval(timer)
  }, [consent, probeAndSync, retryableOperationCount])

  if (consent === null) return fallback
  if (!consent) {
    return (
      <div className="grid gap-4">
        <Card role="region" aria-label="Enable offline work">
          <CardHeader>
            <CardTitle>Keep assigned work on this device</CardTitle>
            <CardDescription>
              Cached job details and pending photos can be read by anyone who
              can use this unlocked browser profile. Use a personally
              controlled, device-lock-protected device.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => {
                void setOfflineConsent(true).then(() => {
                  setConsent(true)
                  queryClient.setQueryData(queryKey, initialPack)
                })
              }}
            >
              Enable offline work
            </Button>
          </CardContent>
        </Card>
        {fallback}
      </div>
    )
  }

  const selectedJob = pack.jobs.find((job) => job.id === selectedJobId) ?? null
  return (
    <div className="grid gap-4">
      <AssignedJobList jobs={pack.jobs} operations={operations} />
      {selectedJob ? (
        <OfflineJobDetail
          job={selectedJob}
          operations={operations.filter(
            (operation) => operation.jobId === selectedJob.id
          )}
          queue={async (kind, payload, photo) => {
            const dependencies = (await getOperations())
              .filter((operation) => operation.jobId === selectedJob.id)
              .map((operation) => operation.clientOperationId)
            const clientOperationId = crypto.randomUUID()
            const operation: OfflineOperation = {
              clientOperationId,
              createdAt: new Date().toISOString(),
              dependsOn: dependencies,
              expectedVersion: selectedJob.version,
              jobId: selectedJob.id,
              kind,
              payload,
              state: "pending",
            }
            if (photo) {
              if (!(await canStorePhoto(photo.size))) {
                throw new Error(
                  "This device does not have enough storage for the photo."
                )
              }
              await putPhoto(clientOperationId, photo)
            }
            await putOperation(operation)
            updatePack((current) => ({
              ...current,
              jobs: current.jobs.map((job) =>
                job.id === selectedJob.id
                  ? projectOperation(job, operation)
                  : job
              ),
            }))
            await refreshOperations()
            if (browserOnlineRef.current && navigator.onLine) void sync()
          }}
        />
      ) : null}
    </div>
  )
}

function AssignedJobList({
  jobs,
  operations,
}: {
  jobs: OfflineJob[]
  operations: OfflineOperation[]
}) {
  return (
    <section aria-label="Assigned jobs" className="grid gap-3">
      <h1 className="text-2xl font-semibold">Jobs</h1>
      {jobs.map((job) => {
        const jobOperations = operations.filter(
          (operation) => operation.jobId === job.id
        )
        const operationState = jobOperations.some(
          (operation) =>
            operation.state === "failed" ||
            operation.state === "needs_attention"
        )
          ? "needs attention"
          : jobOperations.some((operation) => operation.state === "syncing")
            ? "saving"
            : jobOperations.length
              ? "saved on device"
              : null
        return (
          <Card aria-label={`Job ${job.title}`} key={job.id} role="article">
            <CardHeader>
              <CardTitle>{job.title}</CardTitle>
              <CardDescription>{job.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <Badge className="capitalize" variant="outline">
                  {job.status.replace("_", " ")}
                </Badge>
                {operationState ? (
                  <Badge
                    variant={
                      operationState === "needs attention"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {operationState}
                  </Badge>
                ) : null}
              </div>
              <Button
                nativeButton={false}
                render={<Link href={`/dashboard/jobs?job=${job.id}`} />}
              >
                Open job
              </Button>
            </CardContent>
          </Card>
        )
      })}
    </section>
  )
}

function OfflineJobDetail({
  job,
  operations,
  queue,
}: {
  job: OfflineJob
  operations: OfflineOperation[]
  queue: (
    kind: OfflineOperation["kind"],
    payload: OfflineOperation["payload"],
    photo?: Blob
  ) => Promise<void>
}) {
  const [note, setNote] = useState("")
  const pending = operations.some((operation) => operation.state === "syncing")
  const ready =
    (!job.requiresCompletionNote || job.noteCount > 0) &&
    job.evidence.length >= job.minimumCompletionPhotos

  async function run(action: () => Promise<void>, success: string) {
    try {
      await action()
      toast.success(success)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to queue the change."
      )
    }
  }

  async function addPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    const mimeType = mimeTypeForImageUpload(file)
    const detectedMimeType = detectImageMimeType(
      new Uint8Array(await file.arrayBuffer())
    )
    if (
      !mimeType ||
      detectedMimeType !== mimeType ||
      file.size > 10 * 1024 * 1024 ||
      job.evidence.length >= 10
    ) {
      toast.error("Choose a supported image no larger than 10 MB.")
      return
    }
    await run(
      () => queue("photo", { mimeType, sizeBytes: file.size }, file),
      "Photo queued."
    )
  }

  return (
    <Card role="region" aria-label={`Job ${job.title}`}>
      <CardHeader>
        <CardTitle>{job.title}</CardTitle>
        <CardDescription>{job.location || "No location set"}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {job.status === "assigned" ? (
          <Button
            disabled={pending}
            onClick={() =>
              void run(() => queue("start", {}), "Job start queued.")
            }
          >
            Start job
          </Button>
        ) : null}
        {job.status === "in_progress" ? (
          <>
            <Textarea
              aria-label="Work note"
              onChange={(event) => setNote(event.target.value)}
              placeholder="What was completed?"
              value={note}
            />
            <Button
              disabled={!note.trim() || pending}
              onClick={() =>
                void run(async () => {
                  await queue("note", { body: note.trim() })
                  setNote("")
                }, "Note queued.")
              }
              variant="outline"
            >
              Add note
            </Button>
            <Button nativeButton={false} render={<label />} variant="outline">
              <CameraIcon />
              Add completion photo
              <input
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                className="sr-only"
                onChange={(event) => void addPhoto(event)}
                type="file"
              />
            </Button>
            <Button
              disabled={!ready || pending}
              onClick={() =>
                void run(() => queue("submit", {}), "Submission queued.")
              }
            >
              Submit for review
            </Button>
          </>
        ) : null}
        {operations.map((operation) => (
          <p
            className="flex items-center gap-2 text-sm"
            key={operation.clientOperationId}
          >
            {operation.state === "syncing" ? (
              <LoaderCircleIcon className="size-4 animate-spin" />
            ) : null}
            <span className="capitalize">{operation.kind}</span>
            <Badge variant="outline">{operation.state.replace("_", " ")}</Badge>
            {operation.lastError ? <span>{operation.lastError}</span> : null}
          </p>
        ))}
      </CardContent>
    </Card>
  )
}

function projectOperation(
  job: OfflineJob,
  operation: OfflineOperation
): OfflineJob {
  if (operation.kind === "start") {
    return {
      ...job,
      startedAt: new Date().toISOString(),
      status: "in_progress",
    }
  }
  if (operation.kind === "note") {
    return {
      ...job,
      noteCount: job.noteCount + 1,
      timeline: [
        ...job.timeline,
        {
          authorMembershipId: null,
          body: String(operation.payload.body),
          clientOperationId: operation.clientOperationId,
          createdAt: operation.createdAt,
          pending: true,
          type: "note",
        },
      ],
    }
  }
  if (operation.kind === "photo") {
    return {
      ...job,
      evidence: [
        ...job.evidence,
        {
          acknowledged: false,
          clientOperationId: operation.clientOperationId,
          mimeType: String(operation.payload.mimeType),
          sizeBytes: Number(operation.payload.sizeBytes),
        },
      ],
    }
  }
  return { ...job, status: "in_review", submittedAt: operation.createdAt }
}

function acknowledgeOperation(
  job: OfflineJob,
  operation: OfflineOperation,
  version: number,
  result: { assetId?: number; status?: OfflineJob["status"]; updateId?: number }
): OfflineJob {
  return {
    ...job,
    evidence: job.evidence.map((evidence) =>
      evidence.clientOperationId === operation.clientOperationId
        ? { ...evidence, acknowledged: true, id: result.assetId }
        : evidence
    ),
    status: result.status ?? job.status,
    timeline: job.timeline.map((item) =>
      item.clientOperationId === operation.clientOperationId
        ? { ...item, id: result.updateId, pending: false }
        : item
    ),
    version,
  }
}
