"use client"

import Link from "next/link"
import { useActionState, useEffect, useRef, useState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  const firstName = state.values?.firstName ?? employee?.firstName ?? ""
  const lastName = state.values?.lastName ?? employee?.lastName ?? ""
  const email = state.values?.email ?? employee?.email ?? ""
  const phone = state.values?.phone ?? employee?.phone ?? ""
  const jobTitle = state.values?.jobTitle ?? employee?.jobTitle ?? ""

  return (
    <EmployeeProfileFieldControls
      employee={employee}
      idPrefix={idPrefix}
      includeAvatar={includeAvatar}
      includeEmail={includeEmail}
      initialValues={{
        email,
        firstName,
        jobTitle,
        lastName,
        phone,
      }}
      key={JSON.stringify([firstName, lastName, email, phone, jobTitle])}
      state={state}
    />
  )
}

function EmployeeProfileFieldControls({
  employee,
  idPrefix,
  includeAvatar,
  includeEmail,
  initialValues,
  state,
}: {
  employee?: EmployeeSummary
  idPrefix: string
  includeAvatar: boolean
  includeEmail: boolean
  initialValues: {
    email: string
    firstName: string
    jobTitle: string
    lastName: string
    phone: string
  }
  state: ActionState
}) {
  const editing = Boolean(employee)
  const fieldId = (name: string) => `${idPrefix}${name}`
  const [values, setValues] = useState(initialValues)

  const updateValue =
    (field: keyof typeof values) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setValues((current) => ({
        ...current,
        [field]: event.target.value,
      }))
    }

  return (
    <>
      <div className="grid gap-4 pt-2 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={fieldId("firstName")}>First name</FieldLabel>
          <Input
            aria-invalid={Boolean(state.errors?.firstName)}
            id={fieldId("firstName")}
            name="firstName"
            onChange={updateValue("firstName")}
            required
            value={values.firstName}
          />
          <FieldErrors errors={state.errors?.firstName} />
        </Field>
        <Field>
          <FieldLabel htmlFor={fieldId("lastName")}>Last name</FieldLabel>
          <Input
            aria-invalid={Boolean(state.errors?.lastName)}
            id={fieldId("lastName")}
            name="lastName"
            onChange={updateValue("lastName")}
            required
            value={values.lastName}
          />
          <FieldErrors errors={state.errors?.lastName} />
        </Field>
      </div>
      {includeEmail ? (
        <Field>
          <FieldLabel htmlFor={fieldId("email")}>Email</FieldLabel>
          <Input
            aria-invalid={Boolean(state.errors?.email)}
            disabled={editing}
            id={fieldId("email")}
            name="email"
            onChange={updateValue("email")}
            type="email"
            required={!editing}
            value={values.email}
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
            id={fieldId("phone")}
            name="phone"
            onChange={updateValue("phone")}
            required
            value={values.phone}
          />
          <FieldErrors errors={state.errors?.phone} />
        </Field>
        <Field>
          <FieldLabel htmlFor={fieldId("jobTitle")}>Job title</FieldLabel>
          <Input
            aria-invalid={Boolean(state.errors?.jobTitle)}
            id={fieldId("jobTitle")}
            name="jobTitle"
            onChange={updateValue("jobTitle")}
            required
            value={values.jobTitle}
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
  canChooseRole = false,
  employee,
  returnHref = "/dashboard/employees",
  returnLabel = "Back to employees",
  onSuccess,
  showDestinationLink = true,
  showReturn = true,
}: {
  action: EmployeeFormAction
  canChooseRole?: boolean
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
        {!editing ? (
          <Field>
            <FieldLabel htmlFor="role">Role</FieldLabel>
            {canChooseRole ? (
              <Select
                defaultValue={state.values?.role ?? "employee"}
                name="role"
              >
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <>
                <Input name="role" type="hidden" value="employee" />
                <Input disabled id="role" value="Employee" />
              </>
            )}
            <FieldDescription>
              Managers can manage employees and operations. Owners control roles
              and review all submitted work.
            </FieldDescription>
          </Field>
        ) : null}
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
