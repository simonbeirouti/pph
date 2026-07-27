import { EmployeeJobsList } from "@/components/employee-jobs-list"
import { JobWorkspace } from "@/components/job-workspace"
import { requireActiveMembership } from "@/lib/auth/membership"
import { getEmployeeAssignedJobs, getOwnerJobBoardData } from "@/lib/jobs/data"

export default async function Page() {
  const membership = await requireActiveMembership()

  if (membership.role === "employee") {
    const jobs = await getEmployeeAssignedJobs()

    return <EmployeeJobsList jobs={jobs} timezone={membership.timezone} />
  }

  const data = await getOwnerJobBoardData()

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <JobWorkspace
        employees={data.employees}
        initialJobs={data.jobs}
        timezone={data.timezone}
      />
    </div>
  )
}
