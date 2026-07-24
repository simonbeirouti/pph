import { redirect } from "next/navigation"
import { AuthUserHydrator } from "@/components/auth-user-hydrator"
import { LoginForm } from "@/components/login-form"
import { listProjects } from "@/lib/project-data"
import { findUsableProject } from "@eva/core/projects"
import { ensureProfile } from "@/lib/profiles"
import { getCurrentUser } from "@/lib/supabase/user"
import { hasEarlyAccess } from "@/lib/early-access"

export const dynamic = "force-dynamic"

export default async function Page() {
  const user = await getCurrentUser()

  if (user) {
    if (!(await hasEarlyAccess(user.id))) {
      redirect("/access-required")
    }

    await ensureProfile(user)
    const projects = await listProjects()
    const activeProject = findUsableProject(projects)

    redirect(activeProject ? "/dashboard" : "/onboarding")
  }

  return (
    <main className="flex h-dvh min-h-0 flex-col items-center overflow-y-auto overscroll-contain bg-background p-6 md:p-10">
      <AuthUserHydrator user={null} />
      <div className="my-auto w-full max-w-sm">
        <LoginForm />
      </div>
    </main>
  )
}
