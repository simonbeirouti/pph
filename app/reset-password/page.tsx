import { redirect } from "next/navigation"
import { cookies } from "next/headers"

import { ResetPasswordForm } from "@/components/reset-password-form"
import {
  PASSWORD_RECOVERY_COOKIE,
  PASSWORD_RECOVERY_COOKIE_VALUE,
} from "@/lib/auth/recovery"
import { createClient } from "@/lib/supabase/server"

export default async function Page() {
  const cookieStore = await cookies()
  if (
    cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value !==
    PASSWORD_RECOVERY_COOKIE_VALUE
  ) {
    redirect("/auth/confirm/error?reason=verification")
  }
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect("/auth/confirm/error?reason=verification")
  return (
    <main className="flex min-h-svh items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-md">
        <ResetPasswordForm />
      </div>
    </main>
  )
}
