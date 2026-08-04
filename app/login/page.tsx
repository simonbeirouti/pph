import { LoginForm } from "@/components/auth/login-form"
import { AuthScreen } from "@/components/auth/auth-screen"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const { reason } = await searchParams

  return (
    <AuthScreen>
      <LoginForm
        inactive={reason === "inactive"}
        passwordReset={reason === "password-reset"}
      />
    </AuthScreen>
  )
}
