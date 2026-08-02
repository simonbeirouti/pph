import { getMembershipContext } from "@/lib/auth/membership"
import { getJobDetail } from "@/lib/jobs/data"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  const { jobId: rawJobId } = await context.params
  const jobId = Number(rawJobId)
  if (!Number.isSafeInteger(jobId) || jobId < 1) {
    return Response.json({ message: "Job not found." }, { status: 404 })
  }

  if (!(await getMembershipContext())) {
    return Response.json(
      { message: "Active membership required." },
      {
        headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
        status: 401,
      }
    )
  }

  const detail = await getJobDetail(jobId)
  if (!detail) {
    return Response.json(
      { message: "Job not found." },
      {
        headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
        status: 404,
      }
    )
  }

  return Response.json(detail, {
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  })
}
