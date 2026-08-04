"use client"

import * as tus from "tus-js-client"
import {
  CameraIcon,
  CheckIcon,
  FileTextIcon,
  LoaderCircleIcon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import {
  addJobNoteAction,
  archiveJobAction,
  finalizeJobEvidenceUploadAction,
  prepareJobEvidenceUploadAction,
  removeJobEvidenceAction,
  reopenJobAction,
  retryJobNotificationAction,
  startJobAction,
} from "@/app/dashboard/jobs/actions"
import { JobSubmitButton } from "@/components/jobs/job-submit-button"
import {
  updateJobEverywhere,
  useOfflineV2Actions,
} from "@/components/offline/offline-v2-actions"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  formatShortZonedDate,
  formatShortZonedDateTime,
} from "@/lib/date-format"
import type {
  JobBoardEmployee,
  JobDetail,
  JobTimelineItem,
} from "@/lib/jobs/types"
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/browser"
import { mimeTypeForImageUpload } from "@/lib/uploads/image"
import { extensionForImageMimeType } from "@/lib/uploads/image"
import { optimizeJobEvidenceFile } from "@/lib/uploads/job-evidence-optimizer"
import { cn } from "@/lib/utils"

type Role = "employee" | "owner"

const OWNER_JOB_SHEET_CLASS_NAME =
  "data-[side=right]:w-full data-[side=right]:sm:w-[32rem] data-[side=right]:sm:max-w-[32rem]"
const OPEN_HISTORY = ["history"]
const CLOSED_HISTORY: string[] = []

export function EmployeeJobDetail({
  detail,
  onClose,
  onMutationSuccess,
  open: controlledOpen,
  timezone,
}: {
  detail: JobDetail | null
  onClose?: () => void
  onMutationSuccess?: () => Promise<void> | void
  open?: boolean
  timezone: string
}) {
  const mobile = useIsMobile()
  const fallbackClose = useCloseJob()
  const close = onClose ?? fallbackClose
  const selectedJobId = useSearchParams().get("job")
  if (!detail) return null

  const open = controlledOpen ?? selectedJobId === String(detail.id)
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) close()
  }

  if (mobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange} showSwipeHandle>
        <DrawerContent
          className="duration-200 [--drawer-content-max-height:calc(100dvh-1rem)]"
          overlayClassName="duration-200"
        >
          <DrawerHeader>
            <DrawerTitle>{detail.title}</DrawerTitle>
            <JobBadges detail={detail} />
            {detail.description ? (
              <DrawerDescription>{detail.description}</DrawerDescription>
            ) : null}
          </DrawerHeader>
          <JobDetailBody
            detail={detail}
            onClose={close}
            onMutationSuccess={onMutationSuccess}
            role="employee"
            timezone={timezone}
          />
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{detail.title}</DialogTitle>
          <JobBadges detail={detail} />
          {detail.description ? (
            <DialogDescription>{detail.description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <ScrollArea className="-mx-1 min-h-0 flex-1 px-1">
          <JobDetailBody
            detail={detail}
            onClose={close}
            onMutationSuccess={onMutationSuccess}
            role="employee"
            timezone={timezone}
          />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

export function OwnerJobDetail({
  canReview = true,
  detail,
  employees,
  onClose,
  onMutationSuccess,
  open: controlledOpen,
  timezone,
}: {
  canReview?: boolean
  detail: JobDetail | null
  employees: readonly JobBoardEmployee[]
  onClose?: () => void
  onMutationSuccess?: () => Promise<void> | void
  open?: boolean
  timezone: string
}) {
  const fallbackClose = useCloseJob()
  const close = onClose ?? fallbackClose
  const selectedJobId = useSearchParams().get("job")
  if (!detail) return null

  const open = controlledOpen ?? selectedJobId === String(detail.id)
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) close()
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className={OWNER_JOB_SHEET_CLASS_NAME}>
        <SheetHeader className="border-b pr-12">
          <SheetTitle>{detail.title}</SheetTitle>
          <JobBadges align="start" detail={detail} />
          {detail.description ? (
            <SheetDescription>{detail.description}</SheetDescription>
          ) : null}
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1 overflow-hidden">
          <JobDetailBody
            detail={detail}
            onMutationSuccess={onMutationSuccess}
            role="owner"
            timezone={timezone}
          />
        </ScrollArea>
        {canReview ? (
          <OwnerJobActions
            key={detail.id}
            detail={detail}
            employees={employees}
            onMutationSuccess={onMutationSuccess}
            onReopen={close}
          />
        ) : detail.status === "in_review" ? (
          <SheetFooter className="border-t">
            <p className="text-sm text-muted-foreground">
              Owner review required.
            </p>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

export function JobDetailLoading({
  onClose,
  open,
  role,
  title,
}: {
  onClose: () => void
  open: boolean
  role: Role
  title: string
}) {
  const mobile = useIsMobile()
  const content = (
    <div className="grid gap-3 p-4" role="status">
      <p className="font-medium">Loading job details</p>
      <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
      <div className="h-4 w-full animate-pulse rounded bg-muted" />
      <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
    </div>
  )

  if (role === "employee" && mobile) {
    return (
      <Drawer open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>
              Loading the latest job details.
            </DrawerDescription>
          </DrawerHeader>
          {content}
        </DrawerContent>
      </Drawer>
    )
  }

  if (role === "employee") {
    return (
      <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Loading the latest job details.
            </DialogDescription>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent className={OWNER_JOB_SHEET_CLASS_NAME}>
        <SheetHeader className="border-b pr-12">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>Loading the latest job details.</SheetDescription>
        </SheetHeader>
        {content}
      </SheetContent>
    </Sheet>
  )
}

function JobBadges({
  align = "center",
  detail,
}: {
  align?: "center" | "start"
  detail: JobDetail
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2",
        align === "center" ? "justify-center" : "justify-start"
      )}
    >
      <Badge className="capitalize" variant="outline">
        {detail.status.replace("_", " ")}
      </Badge>
      <Badge
        className="capitalize"
        variant={detail.priority === "urgent" ? "destructive" : "secondary"}
      >
        {detail.priority}
      </Badge>
    </div>
  )
}

function JobDetailBody({
  detail,
  onClose,
  onMutationSuccess,
  role,
  timezone,
}: {
  detail: JobDetail
  onClose?: () => void
  onMutationSuccess?: () => Promise<void> | void
  role: Role
  timezone: string
}) {
  const router = useRouter()
  const offline = useOfflineV2Actions()
  const [pending, startTransition] = useTransition()
  const canStart = role === "employee" && detail.status === "assigned"
  const canComplete = role === "employee" && detail.status === "in_progress"
  const showProgress = role === "owner" || detail.status !== "assigned"
  const historyUpdateCount =
    detail.timeline.length +
    (role === "owner" ? detail.notifications.length : 0)

  function run(
    action: () => Promise<{ message: string; ok: boolean }>,
    onSuccess?: () => void
  ) {
    startTransition(async () => {
      const result = await action()
      if (result.ok) {
        toast.success(result.message)
        onSuccess?.()
        if (!offline.usesLocalRepository) {
          router.refresh()
          await onMutationSuccess?.()
        }
      } else {
        toast.error(result.message)
      }
    })
  }

  async function queueJob(
    kind: "job.start" | "job.note",
    payload: Record<string, unknown> = {}
  ) {
    const queued = await offline.queue({
      entityId: detail.id,
      entityType: "job",
      expectedVersion: detail.version ?? null,
      kind,
      payload,
      optimistic: (snapshot) =>
        updateJobEverywhere(snapshot, detail.id, (current) => ({
          ...current,
          ...(kind === "job.start"
            ? {
                startedAt:
                  typeof current.startedAt === "string"
                    ? current.startedAt
                    : new Date().toISOString(),
                status: "in_progress",
              }
            : {}),
          ...(kind === "job.note"
            ? {
                completionNoteCount:
                  Number(current.completionNoteCount ?? 0) + 1,
                noteCount: Number(current.noteCount ?? 0) + 1,
              }
            : {}),
        })),
    })
    return queued
  }

  async function queueNotificationRetry(deliveryId: number) {
    return offline.queue({
      entityId: detail.id,
      entityType: "notification",
      expectedVersion: detail.version ?? null,
      kind: "job.notification.retry",
      payload: { deliveryId },
    })
  }

  return (
    <div className="grid gap-6 px-4 pt-2 pb-[calc(2rem+env(safe-area-inset-bottom))]">
      {role === "employee" &&
      detail.status === "assigned" &&
      detail.latestReopenFeedback ? (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="text-sm font-medium">Owner feedback</p>
          <p className="mt-1 text-sm">{detail.latestReopenFeedback}</p>
        </section>
      ) : null}

      <section aria-label="Job details" className="grid gap-4">
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <DetailTerm
            align="start"
            className="col-span-2"
            label="Assigned to"
            value={assigneeName(detail)}
          />
          <DetailTerm
            align="start"
            label="Location"
            value={detail.location || "Not set"}
          />
          <DetailTerm
            align="start"
            label="Due"
            value={
              detail.dueAt ? formatDateTime(detail.dueAt, timezone) : "Not set"
            }
          />
        </dl>
        {role === "employee" ? <RequirementProgress detail={detail} /> : null}
      </section>

      {canStart ? (
        <Button
          disabled={pending}
          onClick={() =>
            run(async () =>
              (await queueJob("job.start"))
                ? { message: "Job started.", ok: true }
                : startJobAction(detail.id)
            )
          }
          type="button"
        >
          {pending ? <LoaderCircleIcon className="animate-spin" /> : null}
          Start job
        </Button>
      ) : null}

      {canComplete ? (
        <JobChangesEditor
          detail={detail}
          onMutationSuccess={onMutationSuccess}
          timezone={timezone}
        />
      ) : null}

      {role === "employee" ? (
        <JobSubmitButton
          job={{
            ...detail,
            completionNoteCount: detail.noteCount,
            completionPhotoCount: detail.evidence.length,
          }}
          onSuccess={() => onClose?.()}
          variant="default"
        />
      ) : null}

      {showProgress && !canComplete ? (
        <EvidenceGallery
          detail={detail}
          onMutationSuccess={onMutationSuccess}
          timezone={timezone}
        />
      ) : null}

      <Accordion
        defaultValue={role === "owner" ? OPEN_HISTORY : CLOSED_HISTORY}
        key={`${detail.id}-${detail.status}-${role}`}
        multiple
      >
        <AccordionItem value="history">
          <AccordionTrigger
            aria-label={`History, ${historyUpdateCount} ${
              historyUpdateCount === 1 ? "update" : "updates"
            }`}
            className="hover:no-underline"
          >
            <span>
              <span className="block font-medium">History</span>
              <span className="block text-xs font-normal text-muted-foreground">
                {historyUpdateCount}{" "}
                {historyUpdateCount === 1 ? "update" : "updates"}
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <p className="mb-3 text-sm text-muted-foreground">
              Notes, comments, evidence, assignments, status changes, and
              submission emails.
            </p>
            <Timeline
              key={detail.id}
              detail={detail}
              onRetry={(deliveryId) =>
                run(async () =>
                  (await queueNotificationRetry(deliveryId))
                    ? { message: "Email retry queued.", ok: true }
                    : retryJobNotificationAction(deliveryId)
                )
              }
              pending={pending}
              showNotifications={role === "owner"}
              timezone={timezone}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}

function OwnerJobActions({
  detail,
  employees,
  onMutationSuccess,
  onReopen,
}: {
  detail: JobDetail
  employees: readonly JobBoardEmployee[]
  onMutationSuccess?: () => Promise<void> | void
  onReopen: () => void
}) {
  const router = useRouter()
  const offline = useOfflineV2Actions()
  const [pending, startTransition] = useTransition()
  const [reopenOpen, setReopenOpen] = useState(false)
  const [feedback, setFeedback] = useState("")
  const [assignee, setAssignee] = useState(
    detail.assigneeMembershipId ? String(detail.assigneeMembershipId) : ""
  )
  const hasActions =
    detail.status === "in_review" || detail.status === "archived"

  function run(
    action: () => Promise<{ message: string; ok: boolean }>,
    onSuccess?: () => void
  ) {
    startTransition(async () => {
      const result = await action()
      if (result.ok) {
        toast.success(result.message)
        onSuccess?.()
        if (!offline.usesLocalRepository) {
          router.refresh()
          await onMutationSuccess?.()
        }
      } else {
        toast.error(result.message)
      }
    })
  }

  async function queueOwnerJobOperation(
    kind: "job.archive" | "job.reopen",
    payload: Record<string, unknown>
  ) {
    return offline.queue({
      entityId: detail.id,
      entityType: "job",
      expectedVersion: detail.version ?? null,
      kind,
      payload,
      optimistic: (snapshot) =>
        updateJobEverywhere(snapshot, detail.id, (current) => ({
          ...current,
          ...(kind === "job.archive"
            ? { archivedAt: new Date().toISOString(), status: "archived" }
            : {
                archivedAt: null,
                status: "assigned",
                submittedAt: null,
              }),
        })),
    })
  }

  if (!hasActions) return null

  return (
    <>
      <SheetFooter className="shrink-0 border-t bg-popover">
        {detail.status === "in_review" ? (
          <>
            <Button
              disabled={pending}
              onClick={() =>
                run(async () =>
                  (await queueOwnerJobOperation("job.archive", {
                    submissionVersion: detail.submissionVersion,
                  }))
                    ? { message: "Approval saved.", ok: true }
                    : archiveJobAction(detail.id, detail.submissionVersion)
                )
              }
              type="button"
            >
              <CheckIcon />
              Approve and archive
            </Button>
            <Button
              disabled={pending}
              onClick={() => setReopenOpen(true)}
              type="button"
              variant="outline"
            >
              <RotateCcwIcon />
              Reopen job
            </Button>
          </>
        ) : null}
        {detail.status === "archived" ? (
          <Button
            disabled={pending}
            onClick={() => setReopenOpen(true)}
            type="button"
            variant="outline"
          >
            <RotateCcwIcon />
            Reopen archived job
          </Button>
        ) : null}
      </SheetFooter>

      <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reopen job</DialogTitle>
            <DialogDescription>
              Feedback is required and will be shown prominently to the
              employee.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="reopen-feedback">
                Feedback
              </label>
              <Textarea
                id="reopen-feedback"
                onChange={(event) => setFeedback(event.target.value)}
                value={feedback}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="reopen-assignee">
                Assign to
              </label>
              <Select
                onValueChange={(value) => setAssignee(value ?? "")}
                value={assignee}
              >
                <SelectTrigger id="reopen-assignee">
                  <SelectValue placeholder="Choose an employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees
                    .filter((employee) => employee.active)
                    .map((employee) => (
                      <SelectItem
                        key={employee.membershipId}
                        value={String(employee.membershipId)}
                      >
                        {employee.displayName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={pending}
              onClick={() => setReopenOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={pending || !feedback.trim() || !assignee}
              onClick={() =>
                run(
                  async () =>
                    (await queueOwnerJobOperation("job.reopen", {
                      assigneeMembershipId: Number(assignee),
                      feedback,
                      submissionVersion: detail.submissionVersion,
                    }))
                      ? { message: "Reopen saved.", ok: true }
                      : reopenJobAction({
                          assigneeMembershipId: Number(assignee),
                          feedback,
                          jobId: detail.id,
                          submissionVersion: detail.submissionVersion,
                        }),
                  () => {
                    setFeedback("")
                    setReopenOpen(false)
                    onReopen()
                  }
                )
              }
              type="button"
            >
              Reopen job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

type DraftEvidence = {
  file: File
  id: string
  mimeType: NonNullable<ReturnType<typeof mimeTypeForImageUpload>>
  previewUrl: string
  uploadSizeBytes: number
}

function JobChangesEditor({
  detail,
  onMutationSuccess,
  timezone,
}: {
  detail: JobDetail
  onMutationSuccess?: () => Promise<void> | void
  timezone: string
}) {
  const router = useRouter()
  const offline = useOfflineV2Actions()
  const inputRef = useRef<HTMLInputElement>(null)
  const attemptRef = useRef(0)
  const optimizationControllerRef = useRef<AbortController | null>(null)
  const tusUploadRef = useRef<tus.Upload | null>(null)
  const draftsRef = useRef<DraftEvidence[]>([])
  const temporaryAssetIdRef = useRef(0)
  const [drafts, setDrafts] = useState<DraftEvidence[]>([])
  const [note, setNote] = useState("")
  const [saving, startSaving] = useTransition()
  const [uploadState, setUploadState] = useState<
    { phase: "optimizing" } | { phase: "uploading"; progress: number } | null
  >(null)

  useEffect(() => {
    draftsRef.current = drafts
  }, [drafts])

  useEffect(
    () => () => {
      attemptRef.current += 1
      optimizationControllerRef.current?.abort()
      void tusUploadRef.current?.abort(true)
      for (const draft of draftsRef.current) {
        URL.revokeObjectURL(draft.previewUrl)
      }
    },
    []
  )

  async function stageFiles(sourceFiles: readonly File[]) {
    const available = 10 - detail.evidence.length - draftsRef.current.length
    if (available <= 0) return
    const attempt = attemptRef.current + 1
    attemptRef.current = attempt
    optimizationControllerRef.current?.abort()
    const controller = new AbortController()
    optimizationControllerRef.current = controller
    setUploadState({ phase: "optimizing" })

    try {
      const nextDrafts: DraftEvidence[] = []
      for (const sourceFile of sourceFiles.slice(0, available)) {
        const optimized = await optimizeJobEvidenceFile(sourceFile, {
          signal: controller.signal,
        })
        if (attemptRef.current !== attempt || controller.signal.aborted) return
        if (optimized.outcome === "fallback") {
          toast.warning(
            "This photo could not be optimized. Uploading the original instead."
          )
        }
        const mimeType = mimeTypeForImageUpload(optimized.file)
        if (!mimeType) {
          toast.error("Choose a JPEG, PNG, WebP, HEIC, or HEIF image.")
          continue
        }
        nextDrafts.push({
          file: optimized.file,
          id: crypto.randomUUID(),
          mimeType,
          previewUrl: URL.createObjectURL(optimized.file),
          uploadSizeBytes: optimized.uploadSizeBytes,
        })
      }
      if (nextDrafts.length) {
        setDrafts((current) => [...current, ...nextDrafts])
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        toast.error(
          error instanceof Error
            ? error.message
            : "The photo could not be prepared."
        )
      }
    } finally {
      if (attemptRef.current === attempt) {
        optimizationControllerRef.current = null
        setUploadState(null)
        if (inputRef.current) inputRef.current.value = ""
      }
    }
  }

  async function savePhoto(
    draft: DraftEvidence,
    attempt: number
  ): Promise<{ message: string; ok: boolean }> {
    if (temporaryAssetIdRef.current === 0) {
      temporaryAssetIdRef.current = -Date.now()
    }
    const temporaryAssetId = temporaryAssetIdRef.current--
    if (
      await offline.queue({
        blob: draft.file,
        entityId: detail.id,
        entityType: "job",
        expectedVersion: detail.version ?? null,
        kind: "job.evidence.add",
        payload: {
          extension: extensionForImageMimeType(draft.mimeType),
          mimeType: draft.mimeType,
          sizeBytes: draft.file.size,
          temporaryAssetId,
        },
        optimistic: (snapshot) =>
          updateJobEverywhere(snapshot, detail.id, (current) => ({
            ...current,
            completionPhotoCount: Number(current.completionPhotoCount ?? 0) + 1,
            evidence: [
              ...(current.evidence ?? []),
              {
                createdAt: new Date().toISOString(),
                id: temporaryAssetId,
                mimeType: draft.mimeType,
                removable: true,
                signedUrl: URL.createObjectURL(draft.file),
                sizeBytes: draft.file.size,
                uploadedByMembershipId: snapshot.membership.membershipId,
              },
            ],
            pendingEvidenceCount: Number(current.pendingEvidenceCount ?? 0) + 1,
          })),
      })
    ) {
      return { message: "Photo saved on this device.", ok: true }
    }

    const prepared = await prepareJobEvidenceUploadAction({
      jobId: detail.id,
      mimeType: draft.mimeType,
      sizeBytes: draft.uploadSizeBytes,
    })
    if (attemptRef.current !== attempt) {
      return { message: "The photo save was cancelled.", ok: false }
    }
    if (!prepared.ok) return prepared

    const uploadHost = new URL(prepared.uploadUrl).hostname
    const localStorageService =
      uploadHost === "127.0.0.1" || uploadHost === "localhost"
    const headers: Record<string, string> = {
      "x-signature": prepared.signature,
    }

    // The local Storage image predates signed TUS support. Hosted Supabase
    // uses the short-lived signature; local verification uses the session.
    if (localStorageService) {
      const {
        data: { session },
      } = await createBrowserSupabaseClient().auth.getSession()
      if (!session) {
        return {
          message: "Your session expired. Sign in and try the upload again.",
          ok: false,
        }
      }
      delete headers["x-signature"]
      headers.authorization = `Bearer ${session.access_token}`
    }

    setUploadState({ phase: "uploading", progress: 0 })
    return await new Promise((resolve) => {
      const tusUpload = new tus.Upload(draft.file, {
        chunkSize: 6 * 1024 * 1024,
        endpoint: prepared.uploadUrl,
        headers,
        metadata: {
          bucketName: prepared.bucketName,
          cacheControl: "3600",
          contentType: draft.mimeType,
          objectName: prepared.objectName,
        },
        onError(error) {
          if (attemptRef.current !== attempt) return
          resolve({ message: `Upload failed: ${error.message}`, ok: false })
        },
        async onSuccess() {
          if (attemptRef.current !== attempt) return
          const result = await finalizeJobEvidenceUploadAction({
            jobId: detail.id,
            objectName: prepared.objectName,
          })
          if (attemptRef.current !== attempt) return
          resolve(result)
        },
        onProgress(uploaded, total) {
          if (attemptRef.current !== attempt) return
          setUploadState({
            phase: "uploading",
            progress: total > 0 ? Math.round((uploaded / total) * 100) : 0,
          })
        },
        retryDelays: [0, 1_000, 3_000, 5_000],
        removeFingerprintOnSuccess: true,
        uploadDataDuringCreation: true,
      })
      tusUploadRef.current = tusUpload
      tusUpload.start()
    })
  }

  function saveChanges() {
    const noteBody = note.trim()
    const draftsToSave = [...draftsRef.current]
    const attempt = attemptRef.current + 1
    attemptRef.current = attempt

    startSaving(async () => {
      let savedAnything = false
      if (noteBody) {
        const queued = await offline.queue({
          entityId: detail.id,
          entityType: "job",
          expectedVersion: detail.version ?? null,
          kind: "job.note",
          payload: { body: noteBody },
          optimistic: (snapshot) =>
            updateJobEverywhere(snapshot, detail.id, (current) => ({
              ...current,
              completionNoteCount: Number(current.completionNoteCount ?? 0) + 1,
              noteCount: Number(current.noteCount ?? 0) + 1,
            })),
        })
        const result = queued
          ? { message: "Note saved on this device.", ok: true }
          : await addJobNoteAction(detail.id, noteBody)
        if (result.ok) {
          savedAnything = true
          setNote("")
        } else {
          toast.error(result.message)
        }
      }

      const savedDraftIds = new Set<string>()
      for (const draft of draftsToSave) {
        try {
          const result = await savePhoto(draft, attempt)
          if (result.ok) {
            savedAnything = true
            savedDraftIds.add(draft.id)
          } else {
            toast.error(result.message)
          }
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "The photo could not be saved."
          )
        }
      }

      if (savedDraftIds.size) {
        setDrafts((current) =>
          current.filter((draft) => {
            if (!savedDraftIds.has(draft.id)) return true
            URL.revokeObjectURL(draft.previewUrl)
            return false
          })
        )
      }
      tusUploadRef.current = null
      setUploadState(null)
      if (savedAnything) {
        toast.success("Changes saved.")
        if (!offline.usesLocalRepository) {
          router.refresh()
          await onMutationSuccess?.()
        }
      }
    })
  }

  const dirty = Boolean(note.trim() || drafts.length)
  const atPhotoLimit = detail.evidence.length + drafts.length >= 10

  return (
    <section className="grid gap-4" aria-label="Job changes">
      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="job-note">
          Work note or comment
        </label>
        <Input
          id="job-note"
          onChange={(event) => setNote(event.target.value)}
          placeholder="What was completed?"
          value={note}
        />
      </div>

      <EvidenceGallery
        detail={detail}
        onMutationSuccess={onMutationSuccess}
        timezone={timezone}
      />

      {drafts.length ? (
        <div className="grid grid-cols-2 gap-2" aria-label="Selected photos">
          {drafts.map((draft) => (
            <figure
              className="relative overflow-hidden rounded-lg border"
              key={draft.id}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
              <img
                alt="Selected completion photo preview"
                className="aspect-square w-full object-cover"
                src={draft.previewUrl}
              />
              <Button
                aria-label="Remove selected photo"
                className="absolute top-2 right-2"
                disabled={saving}
                onClick={() => {
                  URL.revokeObjectURL(draft.previewUrl)
                  setDrafts((current) =>
                    current.filter((item) => item.id !== draft.id)
                  )
                }}
                size="icon-sm"
                type="button"
                variant="destructive"
              >
                <XIcon />
              </Button>
            </figure>
          ))}
        </div>
      ) : null}

      <Input
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
        aria-label="Completion photos"
        className="sr-only"
        disabled={uploadState !== null || saving || atPhotoLimit}
        id="job-evidence"
        multiple
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          if (files.length) void stageFiles(files)
        }}
        ref={inputRef}
        type="file"
      />
      <button
        aria-label="Add completion photos"
        className="grid min-h-28 w-full place-items-center rounded-lg border border-dashed border-muted-foreground/50 bg-muted/20 text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
        disabled={uploadState !== null || saving || atPhotoLimit}
        onClick={() => inputRef.current?.click()}
        type="button"
      >
        <span className="grid place-items-center gap-2">
          {uploadState?.phase === "optimizing" ? (
            <LoaderCircleIcon className="size-7 animate-spin" />
          ) : (
            <PlusIcon className="size-8" />
          )}
          <span className="text-xs">
            {atPhotoLimit ? "Photo limit reached" : "Add completion photos"}
          </span>
        </span>
      </button>
      <p className="text-xs text-muted-foreground">
        JPEG, PNG, WebP, HEIC, or HEIF · 10 MB source maximum · larger photos
        are optimized · up to 10 photos
      </p>
      {uploadState?.phase === "optimizing" ? (
        <div
          className="flex items-center gap-2 text-xs text-muted-foreground"
          role="status"
        >
          <LoaderCircleIcon className="size-3.5 animate-spin" />
          Optimising photo…
        </div>
      ) : null}
      {uploadState?.phase === "uploading" ? (
        <div className="grid gap-1" role="status">
          <Progress aria-label="Upload progress" value={uploadState.progress} />
          <span className="text-xs text-muted-foreground">
            Uploading {uploadState.progress}%
          </span>
        </div>
      ) : null}
      {dirty ? (
        <Button
          disabled={saving || uploadState !== null}
          onClick={saveChanges}
          type="button"
        >
          {saving ? <LoaderCircleIcon className="animate-spin" /> : null}
          Save
        </Button>
      ) : null}
    </section>
  )
}

function EvidenceGallery({
  detail,
  onMutationSuccess,
  timezone,
}: {
  detail: JobDetail
  onMutationSuccess?: () => Promise<void> | void
  timezone: string
}) {
  const router = useRouter()
  const offline = useOfflineV2Actions()
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const refreshEvidence = () => {
    router.refresh()
    void onMutationSuccess?.()
  }
  if (!detail.evidence.length) return null
  const selectedAsset =
    detail.evidence.find((asset) => asset.id === selectedId) ?? null

  return (
    <>
      <section className="grid gap-3">
        <h3 className="font-medium">Evidence</h3>
        <div className="grid grid-cols-2 gap-2">
          {detail.evidence.map((asset) => {
            const addedDate = formatShortZonedDate(asset.createdAt, timezone)
            return (
              <figure
                className="relative aspect-square overflow-hidden rounded-lg border bg-muted/20"
                key={asset.id}
              >
                <button
                  aria-label={`View completion evidence added ${addedDate}`}
                  className="block size-full cursor-zoom-in"
                  onClick={() => setSelectedId(asset.id)}
                  type="button"
                >
                  <EvidenceImage
                    alt={`Completion evidence added ${addedDate}`}
                    className="size-full object-contain"
                    decoding="async"
                    key={asset.signedUrl}
                    loading="lazy"
                    onLoadError={refreshEvidence}
                    src={asset.signedUrl}
                  />
                </button>
                {asset.removable ? (
                  <Button
                    aria-label="Remove completion photo"
                    className="absolute top-2 right-2"
                    disabled={pendingId === asset.id}
                    onClick={async () => {
                      setPendingId(asset.id)
                      const queued = await offline.queue({
                        entityId: detail.id,
                        entityType: "job",
                        expectedVersion: detail.version ?? null,
                        kind: "job.evidence.remove",
                        payload: { assetId: asset.id },
                        optimistic: (snapshot) =>
                          updateJobEverywhere(
                            snapshot,
                            detail.id,
                            (current) => ({
                              ...current,
                              completionPhotoCount: Math.max(
                                0,
                                Number(current.completionPhotoCount ?? 0) - 1
                              ),
                              evidence: Array.isArray(current.evidence)
                                ? current.evidence.filter(
                                    (item) =>
                                      typeof item !== "object" ||
                                      item === null ||
                                      !("id" in item) ||
                                      item.id !== asset.id
                                  )
                                : [],
                            })
                          ),
                      })
                      const result = queued
                        ? { message: "Photo removal saved.", ok: true }
                        : await removeJobEvidenceAction(detail.id, asset.id)
                      if (result.ok) toast.success(result.message)
                      else toast.error(result.message)
                      setPendingId(null)
                      if (!queued) {
                        router.refresh()
                        await onMutationSuccess?.()
                      }
                    }}
                    size="icon-sm"
                    type="button"
                    variant="destructive"
                  >
                    <Trash2Icon />
                  </Button>
                ) : null}
              </figure>
            )
          })}
        </div>
      </section>
      <Dialog
        onOpenChange={(open) => {
          if (!open) setSelectedId(null)
        }}
        open={selectedAsset !== null}
      >
        <DialogContent className="max-h-[calc(100svh-2rem)] max-w-[calc(100%-2rem)] overflow-hidden p-3 sm:max-w-5xl">
          <DialogHeader className="pr-8">
            <DialogTitle>Completion evidence</DialogTitle>
            <DialogDescription>
              {selectedAsset
                ? `Added ${formatShortZonedDate(selectedAsset.createdAt, timezone)}`
                : null}
            </DialogDescription>
          </DialogHeader>
          {selectedAsset ? (
            <EvidenceImage
              alt={`Full completion evidence added ${formatShortZonedDate(selectedAsset.createdAt, timezone)}`}
              className="max-h-[calc(100svh-8rem)] w-full object-contain"
              key={selectedAsset.signedUrl}
              onLoadError={refreshEvidence}
              src={selectedAsset.signedUrl}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}

function EvidenceImage({
  alt,
  className,
  decoding,
  loading,
  onLoadError,
  src,
}: {
  alt: string
  className: string
  decoding?: "async"
  loading?: "lazy"
  onLoadError: () => void
  src: string
}) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <span
        className={cn(
          "grid place-items-center p-3 text-center text-xs text-muted-foreground",
          className
        )}
        role="status"
      >
        Refreshing the photo…
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- evidence is served with a short-lived authorised URL and cannot use the public image optimizer
    <img
      alt={alt}
      className={className}
      decoding={decoding}
      loading={loading}
      onError={() => {
        setFailed(true)
        onLoadError()
      }}
      src={src}
    />
  )
}

function RequirementProgress({ detail }: { detail: JobDetail }) {
  if (!detail.requiresCompletionNote && detail.minimumCompletionPhotos === 0) {
    return null
  }

  return (
    <div className="grid gap-2 rounded-md bg-muted p-3 text-sm">
      <p className="font-medium">Submission requirements</p>
      <p className="flex items-center gap-2">
        <FileTextIcon className="size-4" />
        {detail.requiresCompletionNote
          ? `${detail.noteCount > 0 ? "Complete" : "Required"}: completion note`
          : "Completion note not required"}
      </p>
      <p className="flex items-center gap-2">
        <CameraIcon className="size-4" />
        {detail.evidence.length} of {detail.minimumCompletionPhotos} required
        photos
      </p>
    </div>
  )
}

function Timeline({
  detail,
  onRetry,
  pending,
  showNotifications,
  timezone,
}: {
  detail: JobDetail
  onRetry: (deliveryId: number) => void
  pending: boolean
  showNotifications: boolean
  timezone: string
}) {
  const [visibleCount, setVisibleCount] = useState(3)
  const names = new Map(
    detail.identities.map((identity) => [
      identity.membershipId,
      identity.displayName,
    ])
  )
  const orderedItems = [
    ...detail.timeline.map((item) => ({
      createdAt: item.createdAt,
      id: `timeline-${item.id}`,
      item,
      kind: "timeline" as const,
    })),
    ...(showNotifications
      ? detail.notifications.map((notification) => ({
          createdAt:
            notification.sentAt ??
            notification.lastAttemptedAt ??
            notification.createdAt ??
            detail.updatedAt,
          id: `notification-${notification.id}`,
          kind: "notification" as const,
          notification,
        }))
      : []),
  ].toSorted(
    (left, right) =>
      Date.parse(right.createdAt) - Date.parse(left.createdAt) ||
      right.id.localeCompare(left.id)
  )
  const visibleItems = orderedItems.slice(0, visibleCount)
  const hasMore = visibleCount < orderedItems.length

  return (
    <div className="grid gap-3">
      {visibleItems.length ? (
        <ol className="grid gap-3">
          {visibleItems.map((entry) => (
            <li
              className={cn(
                "rounded-lg border-l-4 bg-muted/50 p-3 text-sm",
                entry.kind === "notification" && "border-l-sky-400",
                entry.kind === "timeline" &&
                  entry.item.type === "comment" &&
                  "border-l-blue-400",
                entry.kind === "timeline" &&
                  entry.item.type === "note" &&
                  "border-l-emerald-400",
                entry.kind === "timeline" &&
                  entry.item.type === "status_change" &&
                  "border-l-violet-400",
                entry.kind === "timeline" &&
                  entry.item.type === "assignment_change" &&
                  "border-l-amber-400"
              )}
              key={entry.id}
            >
              {entry.kind === "notification" ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">
                      Submission email: {entry.notification.status}
                    </p>
                    <time className="shrink-0 text-xs text-muted-foreground">
                      {formatDateTime(entry.createdAt, timezone)}
                    </time>
                  </div>
                  <p className="text-muted-foreground">
                    {entry.notification.recipientEmail ?? "No active recipient"}
                  </p>
                  {entry.notification.errorMessage ? (
                    <p className="mt-1 text-destructive">
                      {entry.notification.errorMessage}
                    </p>
                  ) : null}
                  {["queued", "failed"].includes(entry.notification.status) ? (
                    <Button
                      className="mt-3"
                      disabled={pending}
                      onClick={() => onRetry(entry.notification.id)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Retry email
                    </Button>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">
                      {timelineLabel(entry.item, names)}
                    </p>
                    <time className="shrink-0 text-xs text-muted-foreground">
                      {formatDateTime(entry.createdAt, timezone)}
                    </time>
                  </div>
                  {entry.item.body ? (
                    <p className="mt-1 whitespace-pre-wrap">
                      {entry.item.body}
                    </p>
                  ) : null}
                </>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">No history yet.</p>
      )}
      {hasMore ? (
        <Button
          onClick={() => setVisibleCount((count) => count + 4)}
          type="button"
          variant="outline"
        >
          Show more
        </Button>
      ) : null}
    </div>
  )
}

function timelineLabel(
  item: JobTimelineItem,
  names: ReadonlyMap<number, string>
) {
  const author = item.authorMembershipId
    ? (names.get(item.authorMembershipId) ?? "Former member")
    : "System"
  if (item.type === "note") return `${author} added a work note`
  if (item.type === "comment") {
    return item.metadata.event === "reopen_feedback"
      ? `${author} requested changes`
      : `${author} commented`
  }
  if (item.type === "status_change") {
    return `Status changed to ${String(item.metadata.new_status ?? "updated").replace("_", " ")}`
  }
  if (item.type === "assignment_change") return "Assignment changed"
  if (item.metadata.event === "evidence_added") return `${author} added a photo`
  if (item.metadata.event === "evidence_removed")
    return `${author} removed a photo`
  return "Job updated"
}

function assigneeName(detail: JobDetail) {
  if (!detail.assigneeMembershipId) return "Unassigned"
  return (
    detail.identities.find(
      (identity) => identity.membershipId === detail.assigneeMembershipId
    )?.displayName ?? "Former member"
  )
}

function DetailTerm({
  align = "center",
  className,
  label,
  value,
}: {
  align?: "center" | "start"
  className?: string
  label: string
  value: string
}) {
  return (
    <div
      className={cn(
        align === "center" ? "text-center" : "text-left",
        className
      )}
    >
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function useCloseJob() {
  const router = useRouter()
  const offline = useOfflineV2Actions()
  return () => {
    const params = new URLSearchParams(window.location.search)
    params.delete("job")
    const query = params.toString()
    const href = `/dashboard/jobs${query ? `?${query}` : ""}`
    if (offline.usesLocalRepository) offline.navigate?.(href, { replace: true })
    else router.replace(href, { scroll: false })
  }
}

function formatDateTime(value: string, timezone: string) {
  return formatShortZonedDateTime(value, timezone)
}
