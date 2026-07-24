import { RosterCalendar } from "@/app/dashboard/roster/roster-calendar";
import { requireActiveProject } from "@/lib/active-project";
import { listProjectAutomationRuns } from "@/lib/project-automation";
import {
  listProjectOutboundEmails,
  listProjectAgentJobs,
  listProjectRosterTasks,
} from "@/lib/project-roster";

export const dynamic = "force-dynamic";

export default async function RosterPage() {
  const project = await requireActiveProject();
  const [tasks, emails, runs, jobs] = await Promise.all([
    listProjectRosterTasks(project.id),
    listProjectOutboundEmails(project.id),
    listProjectAutomationRuns(project.id, { limit: 20 }),
    listProjectAgentJobs(project.id),
  ]);

  return (
    <main className="min-h-0 flex-1 overflow-hidden bg-background">
      <section className="flex h-full min-h-0 w-full p-4">
        <RosterCalendar
          initialEmails={emails}
          initialRuns={runs}
          initialJobs={jobs}
          initialTasks={tasks}
          projectId={project.id}
          projectName={project.name}
        />
      </section>
    </main>
  );
}
