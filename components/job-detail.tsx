"use client"

import * as tus from "tus-js-client"
import {
  CameraIcon,
  CheckIcon,
  FileTextIcon,
  LoaderCircleIcon,
  MessageSquareIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import {
  addJobCommentAction,
  addJobNoteAction,
  archiveJobAction,
  finalizeJobEvidenceUploadAction,
  prepareJobEvidenceUploadAction,
  removeJobEvidenceAction,
  reopenJobAction,
  retryJobNotificationAction,
  startJobAction,
  submitJobAction,
} from "@/app/dashboard/jobs/actions"
import {
  updateJobEverywhere,
  useOfflineV2Actions,
} from "@/components/offline-v2-actions"
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

export function EmployeeJobDetail({
  detail,
  timezone,
}: {
  detail: JobDetail | null
  timezone: string
}) {
  const mobile = useIsMobile()
  const close = useCloseJob()
  if (!detail) return null

  if (mobile) {
    return (
      <Drawer open onOpenChange={(open) => !open && close()} showSwipeHandle>
        <DrawerContent className="[--drawer-content-max-height:calc(100dvh-1rem)]">
          <DrawerHeader>
            <DrawerTitle>{detail.title}</DrawerTitle>
            <JobBadges detail={detail} />
            {detail.description ? (
              <DrawerDescription>{detail.description}</DrawerDescription>
            ) : null}
          </DrawerHeader>
          <JobDetailBody detail={detail} role="employee" timezone={timezone} />
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{detail.title}</DialogTitle>
          <JobBadges detail={detail} />
          {detail.description ? (
            <DialogDescription>{detail.description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <ScrollArea className="-mx-1 min-h-0 flex-1 px-1">
          <JobDetailBody detail={detail} role="employee" timezone={timezone} />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

export function OwnerJobDetail({
  canReview = true,
  detail,
  employees,
  timezone,
}: {
  canReview?: boolean
  detail: JobDetail | null
  employees: readonly JobBoardEmployee[]
  timezone: string
}) {
  const close = useCloseJob()
  if (!detail) return null

  return (
    <Sheet open onOpenChange={(open) => !open && close()}>
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:w-[40vw] data-[side=right]:sm:max-w-[40vw]">
        <SheetHeader className="border-b pr-12">
          <SheetTitle>{detail.title}</SheetTitle>
          <JobBadges align="start" detail={detail} />
          {detail.description ? (
            <SheetDescription>{detail.description}</SheetDescription>
          ) : null}
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1">
          <JobDetailBody detail={detail} role="owner" timezone={timezone} />
        </ScrollArea>
        {canReview ? (
          <OwnerJobActions
            key={detail.id}
            detail={detail}
            employees={employees}
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
  role,
  timezone,
}: {
  detail: JobDetail
  role: Role
  timezone: string
}) {
  const router = useRouter()
  const offline = useOfflineV2Actions()
  const [pending, startTransition] = useTransition()
  const [comment, setComment] = useState("")
  const [note, setNote] = useState("")
  const canStart = role === "employee" && detail.status === "assigned"
  const canComplete = role === "employee" && detail.status === "in_progress"
  const showProgress = role === "owner" || detail.status !== "assigned"
  const requirementReady =
    (!detail.requiresCompletionNote || detail.noteCount > 0) &&
    detail.evidence.length >= detail.minimumCompletionPhotos

  function run(
    action: () => Promise<{ message: string; ok: boolean }>,
    onSuccess?: () => void
  ) {
    startTransition(async () => {
      const result = await action()
      if (result.ok) {
        toast.success(result.message)
        onSuccess?.()
        if (!offline.isOffline) router.refresh()
      } else {
        toast.error(result.message)
      }
    })
  }

  async function queueJob(
    kind:
      | "job.start"
      | "job.note"
      | "job.comment"
      | "job.submit",
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
            ? { noteCount: Number(current.noteCount ?? 0) + 1 }
            : {}),
          ...(kind === "job.submit"
            ? {
                status: "in_review",
                submittedAt: new Date().toISOString(),
              }
            : {}),
        })),
    })
    return queued
  }

  return (
    <div className="grid gap-6 p-4">
      {role === "employee" &&
      detail.status === "assigned" &&
      detail.latestReopenFeedback ? (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="text-sm font-medium">Owner feedback</p>
          <p className="mt-1 text-sm">{detail.latestReopenFeedback}</p>
        </section>
      ) : null}

      <section className="grid gap-4">
        <dl className="grid grid-cols-2 gap-2 text-sm">
          {role === "owner" ? (
            <DetailTerm
              align="start"
              className="col-span-2"
              label="Assigned to"
              value={assigneeName(detail)}
            />
          ) : null}
          <DetailTerm
            align={role === "owner" ? "start" : "center"}
            label="Location"
            value={detail.location || "Not set"}
          />
          <DetailTerm
            align={role === "owner" ? "start" : "center"}
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
        <div className="grid gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="job-note">
              Work note
            </label>
            <Textarea
              id="job-note"
              onChange={(event) => setNote(event.target.value)}
              placeholder="What was completed?"
              value={note}
            />
            <Button
              disabled={pending || !note.trim()}
              onClick={() =>
                run(
                  async () =>
                    (await queueJob("job.note", { body: note }))
                      ? { message: "Note saved.", ok: true }
                      : addJobNoteAction(detail.id, note),
                  () => setNote("")
                )
              }
              type="button"
              variant="outline"
            >
              Add note
            </Button>
          </div>
          <EvidenceUploader detail={detail} />
          <Button
            disabled={pending || !requirementReady}
            onClick={() =>
              run(async () =>
                (await queueJob("job.submit"))
                  ? { message: "Submission saved.", ok: true }
                  : submitJobAction(detail.id)
              )
            }
            type="button"
          >
            Submit for review
          </Button>
        </div>
      ) : null}

      {showProgress ? (
        <EvidenceGallery detail={detail} timezone={timezone} />
      ) : null}

      {showProgress ? (
        <Accordion
          defaultValue={role === "owner" ? ["history", "comments"] : []}
          key={`${detail.id}-${detail.status}-${role}`}
          multiple
        >
          <AccordionItem value="history">
            <AccordionTrigger
              aria-label={`History, ${detail.timeline.length} ${
                detail.timeline.length === 1 ? "update" : "updates"
              }`}
              className="hover:no-underline"
            >
              <span>
                <span className="block font-medium">History</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {detail.timeline.length}{" "}
                  {detail.timeline.length === 1 ? "update" : "updates"}
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <p className="mb-3 text-sm text-muted-foreground">
                Notes, comments, evidence, assignments, and status changes.
              </p>
              <Timeline key={detail.id} detail={detail} timezone={timezone} />
            </AccordionContent>
          </AccordionItem>

          {role === "owner" ? (
            <AccordionItem value="comments">
              <AccordionTrigger className="hover:no-underline">
                Comments
              </AccordionTrigger>
              <AccordionContent className="grid gap-2">
                <label className="text-sm font-medium" htmlFor="job-comment">
                  Add comment
                </label>
                <Textarea
                  id="job-comment"
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Write a comment…"
                  value={comment}
                />
                <Button
                  disabled={pending || !comment.trim()}
                  onClick={() =>
                    run(
                      async () =>
                        (await queueJob("job.comment", { body: comment }))
                          ? { message: "Comment saved.", ok: true }
                          : addJobCommentAction(detail.id, comment),
                      () => setComment("")
                    )
                  }
                  type="button"
                  variant="outline"
                >
                  <MessageSquareIcon />
                  Comment
                </Button>
              </AccordionContent>
            </AccordionItem>
          ) : null}
        </Accordion>
      ) : null}
    </div>
  )
}

function OwnerJobActions({
  detail,
  employees,
}: {
  detail: JobDetail
  employees: readonly JobBoardEmployee[]
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
    detail.notifications.length > 0 ||
    detail.status === "in_review" ||
    detail.status === "archived"

  function run(
    action: () => Promise<{ message: string; ok: boolean }>,
    onSuccess?: () => void
  ) {
    startTransition(async () => {
      const result = await action()
      if (result.ok) {
        toast.success(result.message)
        onSuccess?.()
        if (!offline.isOffline) router.refresh()
      } else {
        toast.error(result.message)
      }
    })
  }

  async function queueOwnerJobOperation(
    kind:
      | "job.archive"
      | "job.reopen"
      | "job.notification.retry",
    payload: Record<string, unknown>
  ) {
    return offline.queue({
      entityId: detail.id,
      entityType: kind === "job.notification.retry" ? "notification" : "job",
      expectedVersion: detail.version ?? null,
      kind,
      payload,
      optimistic:
        kind === "job.notification.retry"
          ? undefined
          : (snapshot) =>
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
        {detail.notifications.map((notification) => (
          <div className="text-sm" key={notification.id}>
            <p>
              Submission email:{" "}
              <span className="font-medium capitalize">
                {notification.status}
              </span>
            </p>
            <p className="text-muted-foreground">
              {notification.recipientEmail ?? "No active recipient"}
            </p>
            {notification.errorMessage ? (
              <p className="mt-1 text-destructive">
                {notification.errorMessage}
              </p>
            ) : null}
            {["queued", "failed"].includes(notification.status) ? (
              <Button
                className="mt-3"
                disabled={pending}
                onClick={() =>
                  run(async () =>
                    (await queueOwnerJobOperation(
                      "job.notification.retry",
                      { deliveryId: notification.id }
                    ))
                      ? { message: "Email retry queued.", ok: true }
                      : retryJobNotificationAction(notification.id)
                  )
                }
                size="sm"
                type="button"
                variant="outline"
              >
                Retry email
              </Button>
            ) : null}
          </div>
        ))}
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

function EvidenceUploader({ detail }: { detail: JobDetail }) {
  const router = useRouter()
  const offline = useOfflineV2Actions()
  const inputRef = useRef<HTMLInputElement>(null)
  const attemptRef = useRef(0)
  const optimizationControllerRef = useRef<AbortController | null>(null)
  const tusUploadRef = useRef<tus.Upload | null>(null)
  const [uploadState, setUploadState] = useState<
    { phase: "optimizing" } | { phase: "uploading"; progress: number } | null
  >(null)

  useEffect(
    () => () => {
      attemptRef.current += 1
      optimizationControllerRef.current?.abort()
      void tusUploadRef.current?.abort(true)
    },
    []
  )

  async function upload(sourceFile: File) {
    const attempt = attemptRef.current + 1
    attemptRef.current = attempt
    optimizationControllerRef.current?.abort()
    void tusUploadRef.current?.abort(true)
    const controller = new AbortController()
    optimizationControllerRef.current = controller
    setUploadState({ phase: "optimizing" })

    const reset = () => {
      if (attemptRef.current !== attempt) return
      optimizationControllerRef.current = null
      tusUploadRef.current = null
      setUploadState(null)
      if (inputRef.current) inputRef.current.value = ""
    }

    try {
      const optimized = await optimizeJobEvidenceFile(sourceFile, {
        signal: controller.signal,
      })
      if (attemptRef.current !== attempt || controller.signal.aborted) return

      if (optimized.outcome === "fallback") {
        toast.warning(
          "This photo could not be optimized. Uploading the original instead."
        )
      }
      const file = optimized.file
      const mimeType = mimeTypeForImageUpload(file)
      if (!mimeType) {
        toast.error("Choose a JPEG, PNG, WebP, HEIC, or HEIF image.")
        reset()
        return
      }
      const temporaryAssetId = -Date.now()
      if (
        await offline.queue({
          blob: file,
          entityId: detail.id,
          entityType: "job",
          expectedVersion: detail.version ?? null,
          kind: "job.evidence.add",
          payload: {
            extension: extensionForImageMimeType(mimeType),
            mimeType,
            sizeBytes: file.size,
            temporaryAssetId,
          },
          optimistic: (snapshot) =>
            updateJobEverywhere(snapshot, detail.id, (current) => ({
              ...current,
              evidence: [
                ...(current.evidence ?? []),
                {
                  createdAt: new Date().toISOString(),
                  id: temporaryAssetId,
                  mimeType,
                  removable: true,
                  signedUrl: URL.createObjectURL(file),
                  sizeBytes: file.size,
                  uploadedByMembershipId:
                    snapshot.membership.membershipId,
                },
              ],
              pendingEvidenceCount:
                Number(current.pendingEvidenceCount ?? 0) + 1,
            })),
        })
      ) {
        toast.success("Photo saved on this device")
        reset()
        return
      }

      const prepared = await prepareJobEvidenceUploadAction({
        jobId: detail.id,
        mimeType,
        sizeBytes: optimized.uploadSizeBytes,
      })
      if (attemptRef.current !== attempt || controller.signal.aborted) return
      if (!prepared.ok) {
        toast.error(prepared.message)
        reset()
        return
      }
      const uploadHost = new URL(prepared.uploadUrl).hostname
      const localStorageService =
        uploadHost === "127.0.0.1" || uploadHost === "localhost"
      const headers: Record<string, string> = {
        "x-signature": prepared.signature,
      }

      // The current local Storage image predates signed TUS support. Hosted
      // Supabase uses the short-lived signature; local verification uses the
      // user's access token and the same Storage path policy.
      if (localStorageService) {
        const {
          data: { session },
        } = await createBrowserSupabaseClient().auth.getSession()
        if (!session) {
          toast.error("Your session expired. Sign in and try the upload again.")
          reset()
          return
        }
        delete headers["x-signature"]
        headers.authorization = `Bearer ${session.access_token}`
      }

      if (attemptRef.current !== attempt || controller.signal.aborted) return
      setUploadState({ phase: "uploading", progress: 0 })
      const tusUpload = new tus.Upload(file, {
        chunkSize: 6 * 1024 * 1024,
        endpoint: prepared.uploadUrl,
        headers,
        metadata: {
          bucketName: prepared.bucketName,
          cacheControl: "3600",
          contentType: mimeType,
          objectName: prepared.objectName,
        },
        onError(error) {
          if (attemptRef.current !== attempt) return
          toast.error(`Upload failed: ${error.message}`)
          reset()
        },
        async onSuccess() {
          if (attemptRef.current !== attempt) return
          const result = await finalizeJobEvidenceUploadAction({
            jobId: detail.id,
            objectName: prepared.objectName,
          })
          if (attemptRef.current !== attempt) return
          if (result.ok) toast.success(result.message)
          else toast.error(result.message)
          reset()
          router.refresh()
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
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return
      }
      toast.error(
        error instanceof Error ? error.message : "The photo could not upload."
      )
      reset()
    }
  }

  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium" htmlFor="job-evidence">
        Completion photos
      </label>
      <Input
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
        disabled={uploadState !== null || detail.evidence.length >= 10}
        id="job-evidence"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void upload(file)
        }}
        ref={inputRef}
        type="file"
      />
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
    </div>
  )
}

function EvidenceGallery({
  detail,
  timezone,
}: {
  detail: JobDetail
  timezone: string
}) {
  const router = useRouter()
  const offline = useOfflineV2Actions()
  const [pendingId, setPendingId] = useState<number | null>(null)
  if (!detail.evidence.length) return null

  return (
    <section className="grid gap-3">
      <h3 className="font-medium">Evidence</h3>
      <div className="grid grid-cols-2 gap-2">
        {detail.evidence.map((asset) => (
          <figure
            className="relative overflow-hidden rounded-lg border"
            key={asset.id}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- the authorised URL expires in five minutes and cannot use the public image optimizer */}
            <img
              alt={`Completion evidence added ${formatShortZonedDate(asset.createdAt, timezone)}`}
              className="aspect-square w-full object-cover"
              src={asset.signedUrl}
            />
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
                  if (!queued) router.refresh()
                }}
                size="icon-sm"
                type="button"
                variant="destructive"
              >
                <Trash2Icon />
              </Button>
            ) : null}
          </figure>
        ))}
      </div>
    </section>
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
  timezone,
}: {
  detail: JobDetail
  timezone: string
}) {
  const [visibleCount, setVisibleCount] = useState(3)
  const names = new Map(
    detail.identities.map((identity) => [
      identity.membershipId,
      identity.displayName,
    ])
  )
  const orderedItems = detail.timeline.toSorted(
    (left, right) =>
      Date.parse(right.createdAt) - Date.parse(left.createdAt) ||
      right.id - left.id
  )
  const visibleItems = orderedItems.slice(0, visibleCount)
  const hasMore = visibleCount < detail.timeline.length

  return (
    <div className="grid gap-3">
      {visibleItems.length ? (
        <ol className="grid gap-3">
          {visibleItems.map((item) => (
            <li
              className={cn(
                "rounded-lg border-l-4 bg-muted/50 p-3 text-sm",
                item.type === "comment" && "border-l-blue-400",
                item.type === "note" && "border-l-emerald-400",
                item.type === "status_change" && "border-l-violet-400",
                item.type === "assignment_change" && "border-l-amber-400"
              )}
              key={item.id}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">{timelineLabel(item, names)}</p>
                <time className="shrink-0 text-xs text-muted-foreground">
                  {formatDateTime(item.createdAt, timezone)}
                </time>
              </div>
              {item.body ? (
                <p className="mt-1 whitespace-pre-wrap">{item.body}</p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">No history yet.</p>
      )}
      {hasMore ? (
        <Button
          onClick={() => setVisibleCount((count) => count + 3)}
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
    if (offline.isOffline) offline.navigate?.(href, { replace: true })
    else router.replace(href, { scroll: false })
  }
}

function formatDateTime(value: string, timezone: string) {
  return formatShortZonedDateTime(value, timezone)
}
