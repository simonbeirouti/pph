import { redirect } from "next/navigation"

import { SetPasswordForm } from "@/components/set-password-form"
import { getInvitedMembershipForCurrentUser } from "@/lib/auth/invitation"

export default async function Page() {
  const invitation = await getInvitedMembershipForCurrentUser()
  if (!invitation) redirect("/auth/confirm/error")

  return (
    <main className="flex min-h-svh items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-md">
        <SetPasswordForm email={invitation.email} />
      </div>
    </main>
  )
}
