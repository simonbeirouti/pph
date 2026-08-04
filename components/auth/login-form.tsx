"use client"

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react"
import { toast } from "sonner"

import { loginAction, requestPasswordRecoveryAction } from "@/app/login/actions"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { INITIAL_ACTION_STATE } from "@/lib/forms/action-state"
import { cn } from "@/lib/utils"

export function LoginForm({
  inactive = false,
  passwordReset = false,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  inactive?: boolean
  passwordReset?: boolean
}) {
  const [state, action, pending] = useActionState(
    loginAction,
    INITIAL_ACTION_STATE
  )
  const formRef = useRef<HTMLFormElement>(null)
  const [recoveryError, setRecoveryError] = useState<string | null>(null)
  const [recoveryPending, startRecoveryTransition] = useTransition()

  useEffect(() => {
    if (state.message) toast.error(state.message)
  }, [state])

  useEffect(() => {
    if (passwordReset) toast.success("Password reset. You can now sign in.")
  }, [passwordReset])

  const requestRecovery = () => {
    const form = formRef.current
    if (!form) return
    const email = form?.elements.namedItem("email")
    if (!(email instanceof HTMLInputElement) || !email.reportValidity()) return
    startRecoveryTransition(async () => {
      const result = await requestPasswordRecoveryAction(new FormData(form))
      setRecoveryError(
        result.ok ? null : (result.message ?? "Unable to send reset email.")
      )
      if (result.ok) toast.success(result.message)
      else toast.error(result.message)
    })
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="grid gap-6">
        <div className="text-center text-white">
          <h1 className="text-2xl font-semibold">Sign in</h1>
          <p className="mt-2 text-sm text-white/80">
            {inactive
              ? "Your access is unavailable. Contact your organisation owner if you believe this is a mistake."
              : "Use your organisation email and password."}
          </p>
        </div>
        <form action={action} ref={formRef}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                aria-invalid={Boolean(state.errors?.email)}
                defaultValue={state.values?.email}
                key={state.values?.email}
                id="email"
                name="email"
                type="email"
                placeholder="m@example.com"
                required
              />
              {(recoveryError ? [recoveryError] : state.errors?.email)?.map(
                (error) => (
                  <FieldDescription className="text-destructive" key={error}>
                    {error}
                  </FieldDescription>
                )
              )}
            </Field>
            <Field>
              <div className="flex items-center justify-between gap-3">
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Button
                  className="h-auto p-0 text-xs"
                  disabled={pending || recoveryPending}
                  onClick={requestRecovery}
                  type="button"
                  variant="link"
                >
                  {recoveryPending ? "Sending…" : "Forgot password?"}
                </Button>
              </div>
              <Input
                aria-invalid={Boolean(state.errors?.password)}
                id="password"
                name="password"
                type="password"
                required
              />
              {state.errors?.password?.map((error) => (
                <FieldDescription className="text-destructive" key={error}>
                  {error}
                </FieldDescription>
              ))}
            </Field>
            <Field>
              <Button type="submit" disabled={pending || recoveryPending}>
                {pending ? "Signing in…" : "Sign in"}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </div>
    </div>
  )
}
