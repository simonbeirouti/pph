"use client"

import { LoaderCircleIcon, SendIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"

import { submitJobAction } from "@/app/dashboard/jobs/actions"
import {
  submitJobEverywhere,
  useOfflineV2Actions,
} from "@/components/offline/offline-v2-actions"
import { Button } from "@/components/ui/button"
import type { JobCard } from "@/lib/jobs/types"

export function jobSubmissionRequirementsMet(job: JobCard) {
  return (
    typeof job.completionNoteCount === "number" &&
    typeof job.completionPhotoCount === "number" &&
    (!job.requiresCompletionNote || job.completionNoteCount > 0) &&
    job.completionPhotoCount >= job.minimumCompletionPhotos
  )
}

export function canSubmitJob(job: JobCard) {
  return (
    jobSubmissionRequirementsMet(job) &&
    (job.status === "assigned" || job.status === "in_progress")
  )
}

export function JobSubmitButton({
  job,
  onSuccess,
  variant = "outline",
}: {
  job: JobCard
  onSuccess?: (queued: boolean) => Promise<void> | void
  variant?: "default" | "outline"
}) {
  const router = useRouter()
  const offline = useOfflineV2Actions()
  const [pending, startTransition] = useTransition()

  if (!canSubmitJob(job)) return null

  return (
    <Button
      aria-label="Submit for review"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const submittedAt = new Date().toISOString()
          const queued = await offline.queue({
            entityId: job.id,
            entityType: "job",
            expectedVersion: job.version ?? null,
            kind: "job.submit",
            optimistic: (snapshot) =>
              submitJobEverywhere(snapshot, job.id, submittedAt),
          })
          const result = queued
            ? { message: "Submission saved.", ok: true }
            : await submitJobAction(job.id)

          if (!result.ok) {
            toast.error(result.message)
            return
          }

          toast.success(result.message)
          if (!queued) {
            await offline.updateSnapshot?.((snapshot) =>
              submitJobEverywhere(snapshot, job.id, submittedAt)
            )
            router.refresh()
          }
          await onSuccess?.(queued)
        })
      }}
      type="button"
      variant={variant}
    >
      {pending ? <LoaderCircleIcon className="animate-spin" /> : <SendIcon />}
      Submit
    </Button>
  )
}
