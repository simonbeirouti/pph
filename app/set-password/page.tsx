import { redirect } from "next/navigation"

import { AuthScreen } from "@/components/auth-screen"
import { SetPasswordForm } from "@/components/set-password-form"
import { getInvitedMembershipForCurrentUser } from "@/lib/auth/invitation"

export default async function Page() {
  const invitation = await getInvitedMembershipForCurrentUser()
  if (!invitation) redirect("/auth/confirm/error")

  return (
    <AuthScreen>
      <SetPasswordForm email={invitation.email} />
    </AuthScreen>
  )
}
