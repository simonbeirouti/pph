"use client"

import Link from "next/link"
import { useActionState, useEffect, useRef } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { EmployeeSummary } from "@/lib/employees/data"
import {
  INITIAL_ACTION_STATE,
  type ActionState,
} from "@/lib/forms/action-state"

type EmployeeFormAction = (
  state: ActionState,
  formData: FormData
) => Promise<ActionState>

export function FieldErrors({ errors }: { errors: string[] | undefined }) {
  return errors?.map((error) => (
    <FieldDescription className="text-destructive" key={error}>
      {error}
    </FieldDescription>
  ))
}

export function EmployeeProfileFields({
  employee,
  idPrefix = "",
  includeAvatar = true,
  includeEmail = true,
  state,
}: {
  employee?: EmployeeSummary
  idPrefix?: string
  includeAvatar?: boolean
  includeEmail?: boolean
  state: ActionState
}) {
  const editing = Boolean(employee)
  const fieldId = (name: string) => `${idPrefix}${name}`

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={fieldId("firstName")}>First name</FieldLabel>
          <Input
            aria-invalid={Boolean(state.errors?.firstName)}
            defaultValue={state.values?.firstName ?? employee?.firstName}
            key={`firstName-${state.values?.firstName ?? ""}`}
            id={fieldId("firstName")}
            name="firstName"
            required
          />
          <FieldErrors errors={state.errors?.firstName} />
        </Field>
        <Field>
          <FieldLabel htmlFor={fieldId("lastName")}>Last name</FieldLabel>
          <Input
            aria-invalid={Boolean(state.errors?.lastName)}
            defaultValue={state.values?.lastName ?? employee?.lastName}
            key={`lastName-${state.values?.lastName ?? ""}`}
            id={fieldId("lastName")}
            name="lastName"
            required
          />
          <FieldErrors errors={state.errors?.lastName} />
        </Field>
      </div>
      {includeEmail ? (
        <Field>
          <FieldLabel htmlFor={fieldId("email")}>Email</FieldLabel>
          <Input
            aria-invalid={Boolean(state.errors?.email)}
            defaultValue={state.values?.email ?? employee?.email}
            disabled={editing}
            key={`email-${state.values?.email ?? ""}`}
            id={fieldId("email")}
            name="email"
            type="email"
            required={!editing}
          />
          {editing ? (
            <FieldDescription>
              Email is the account’s sign-in identity and cannot be edited.
            </FieldDescription>
          ) : null}
          <FieldErrors errors={state.errors?.email} />
        </Field>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={fieldId("phone")}>Phone</FieldLabel>
          <Input
            aria-invalid={Boolean(state.errors?.phone)}
            defaultValue={state.values?.phone ?? employee?.phone}
            key={`phone-${state.values?.phone ?? ""}`}
            id={fieldId("phone")}
            name="phone"
            required
          />
          <FieldErrors errors={state.errors?.phone} />
        </Field>
        <Field>
          <FieldLabel htmlFor={fieldId("jobTitle")}>Job title</FieldLabel>
          <Input
            aria-invalid={Boolean(state.errors?.jobTitle)}
            defaultValue={state.values?.jobTitle ?? employee?.jobTitle}
            key={`jobTitle-${state.values?.jobTitle ?? ""}`}
            id={fieldId("jobTitle")}
            name="jobTitle"
            required
          />
          <FieldErrors errors={state.errors?.jobTitle} />
        </Field>
      </div>
      {includeAvatar ? (
        <Field>
          <FieldLabel htmlFor={fieldId("avatar")}>
            {editing ? "Replace profile photo" : "Profile photo (optional)"}
          </FieldLabel>
          <Input
            accept="image/jpeg,image/png,image/webp"
            aria-invalid={Boolean(state.errors?.avatar)}
            id={fieldId("avatar")}
            name="avatar"
            type="file"
          />
          <FieldDescription>JPEG, PNG, or WebP; maximum 5 MB.</FieldDescription>
          <FieldErrors errors={state.errors?.avatar} />
        </Field>
      ) : null}
    </>
  )
}

export function EmployeeForm({
  action,
  employee,
  returnHref = "/dashboard/employees",
  returnLabel = "Back to employees",
  onSuccess,
  showDestinationLink = true,
  showReturn = true,
}: {
  action: EmployeeFormAction
  employee?: EmployeeSummary
  onSuccess?: (state: ActionState) => void
  returnHref?: string
  returnLabel?: string
  showDestinationLink?: boolean
  showReturn?: boolean
}) {
  const [state, formAction, pending] = useActionState(
    action,
    INITIAL_ACTION_STATE
  )
  const handledSuccess = useRef<string | null>(null)
  const editing = Boolean(employee)

  useEffect(() => {
    if (state.ok && state.message && handledSuccess.current !== state.message) {
      handledSuccess.current = state.message
      onSuccess?.(state)
    }
  }, [onSuccess, state])

  return (
    <form action={formAction}>
      <FieldGroup>
        {state.message ? (
          <Alert variant={state.ok ? "default" : "destructive"}>
            <AlertDescription>
              {state.message}{" "}
              {state.destinationId && showDestinationLink ? (
                <Link
                  className="underline"
                  href={`/dashboard/employees/${state.destinationId}`}
                >
                  View employee
                </Link>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}
        {state.warnings?.map((warning) => (
          <Alert key={warning}>
            <AlertDescription>{warning}</AlertDescription>
          </Alert>
        ))}
        <EmployeeProfileFields employee={employee} state={state} />
        <div className="flex flex-wrap gap-3">
          <Button disabled={pending} type="submit">
            {pending
              ? editing
                ? "Saving…"
                : "Creating…"
              : editing
                ? "Save profile"
                : "Create and invite"}
          </Button>
          {showReturn ? (
            <Button
              nativeButton={false}
              variant="outline"
              render={<Link href={returnHref} />}
            >
              {returnLabel}
            </Button>
          ) : null}
        </div>
      </FieldGroup>
    </form>
  )
}
