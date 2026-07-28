"use client"

import { useActionState, useEffect } from "react"
import { toast } from "sonner"

import { loginAction } from "@/app/login/actions"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
  className,
  ...props
}: React.ComponentProps<"div"> & { inactive?: boolean }) {
  const [state, action, pending] = useActionState(
    loginAction,
    INITIAL_ACTION_STATE
  )

  useEffect(() => {
    if (state.message) toast.error(state.message)
  }, [state])

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>
            <h1>Sign in</h1>
          </CardTitle>
          <CardDescription>
            {inactive
              ? "Your access is unavailable. Contact your organisation owner if you believe this is a mistake."
              : "Use your organisation email and password."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action}>
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
                {state.errors?.email?.map((error) => (
                  <FieldDescription className="text-destructive" key={error}>
                    {error}
                  </FieldDescription>
                ))}
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
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
                <Button type="submit" disabled={pending}>
                  {pending ? "Signing in…" : "Sign in"}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
