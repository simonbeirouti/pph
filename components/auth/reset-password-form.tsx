"use client"

import { useActionState } from "react"

import { resetPasswordAction } from "@/app/reset-password/actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { INITIAL_ACTION_STATE } from "@/lib/forms/action-state"

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(
    resetPasswordAction,
    INITIAL_ACTION_STATE
  )
  return (
    <div className="grid gap-6">
      <div className="text-center text-white">
        <h1 className="text-2xl font-semibold">Reset your password</h1>
        <p className="mt-2 text-sm text-white/80">
          Choose a new password for your account.
        </p>
      </div>
      <form action={action}>
        <FieldGroup>
          {state.message ? (
            <Alert variant="destructive">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}
          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              aria-invalid={Boolean(state.errors?.password)}
              autoComplete="new-password"
              id="password"
              name="password"
              required
              type="password"
            />
            <FieldDescription>
              Use 8+ characters with upper and lowercase letters, a number, and
              a symbol.
            </FieldDescription>
            {state.errors?.password?.map((error) => (
              <FieldDescription className="text-destructive" key={error}>
                {error}
              </FieldDescription>
            ))}
          </Field>
          <Field>
            <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
            <Input
              aria-invalid={Boolean(state.errors?.confirmPassword)}
              autoComplete="new-password"
              id="confirmPassword"
              name="confirmPassword"
              required
              type="password"
            />
            {state.errors?.confirmPassword?.map((error) => (
              <FieldDescription className="text-destructive" key={error}>
                {error}
              </FieldDescription>
            ))}
          </Field>
          <Button disabled={pending} type="submit">
            {pending ? "Resetting…" : "Reset password"}
          </Button>
        </FieldGroup>
      </form>
    </div>
  )
}
