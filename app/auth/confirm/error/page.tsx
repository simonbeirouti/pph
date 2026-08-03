import Link from "next/link"

import { AuthScreen } from "@/components/auth-screen"
import { Button } from "@/components/ui/button"

export default function Page() {
  return (
    <AuthScreen>
      <div className="grid gap-6 text-center text-white">
        <div>
          <h1 className="text-2xl font-semibold">Account link unavailable</h1>
          <p className="mt-2 text-sm text-white/80">
            This invitation or password-reset link is invalid, expired, or has
            already been used.
          </p>
        </div>
        <p className="text-sm text-white/80">
          Return to sign in to request another password reset, or contact your
          organisation owner for help with an invitation.
        </p>
        <Button nativeButton={false} render={<Link href="/login" />}>
          Return to sign in
        </Button>
      </div>
    </AuthScreen>
  )
}
