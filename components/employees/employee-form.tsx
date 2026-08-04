"use client"

import Link from "next/link"
import { useActionState, useEffect, useRef, useState } from "react"
import { CameraIcon } from "lucide-react"

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
  createLayout = false,
  idPrefix = "",
  includeAvatar = true,
  includeEmail = true,
  includeJobTitle = true,
  state,
}: {
  employee?: EmployeeSummary
  createLayout?: boolean
  idPrefix?: string
  includeAvatar?: boolean
  includeEmail?: boolean
  includeJobTitle?: boolean
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
      createLayout={createLayout}
      idPrefix={idPrefix}
      includeAvatar={includeAvatar}
      includeEmail={includeEmail}
      includeJobTitle={includeJobTitle}
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
  createLayout,
  idPrefix,
  includeAvatar,
  includeEmail,
  includeJobTitle,
  initialValues,
  state,
}: {
  employee?: EmployeeSummary
  createLayout: boolean
  idPrefix: string
  includeAvatar: boolean
  includeEmail: boolean
  includeJobTitle: boolean
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
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  useEffect(
    () => () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    },
    [avatarPreview]
  )

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
      {includeAvatar && createLayout ? (
        <Field className="items-center [&>button]:w-24 [&>button]:max-w-24">
          <Input
            accept="image/jpeg,image/png,image/webp"
            aria-invalid={Boolean(state.errors?.avatar)}
            aria-label="Profile photo"
            className="sr-only"
            id={fieldId("avatar")}
            name="avatar"
            onChange={(event) => {
              if (avatarPreview) URL.revokeObjectURL(avatarPreview)
              const file = event.target.files?.[0]
              setAvatarPreview(file ? URL.createObjectURL(file) : null)
            }}
            ref={avatarInputRef}
            type="file"
          />
          <button
            aria-label="Upload profile photo"
            className="relative grid aspect-square size-24 shrink-0 place-items-center overflow-hidden rounded-full border bg-muted text-xl font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            onClick={() => avatarInputRef.current?.click()}
            type="button"
          >
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
              <img
                alt="Selected profile preview"
                className="size-full object-cover"
                src={avatarPreview}
              />
            ) : values.firstName || values.lastName ? (
              `${values.firstName.charAt(0)}${values.lastName.charAt(0)}`.toUpperCase()
            ) : (
              <CameraIcon className="size-7" />
            )}
          </button>
          <FieldDescription className="text-center">
            JPEG, PNG, or WebP; maximum 5 MB.
          </FieldDescription>
          <FieldErrors errors={state.errors?.avatar} />
        </Field>
      ) : null}
      {includeEmail && !createLayout ? (
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
          <FieldErrors errors={state.errors?.email} />
        </Field>
      ) : null}
      <div
        className={
          createLayout
            ? "grid grid-cols-2 gap-4 pt-2"
            : !includeJobTitle
              ? "grid grid-cols-1 gap-4"
              : "grid gap-4 pt-2 sm:grid-cols-2"
        }
        data-employee-form-row={createLayout ? "name" : undefined}
      >
        <Field className={!includeJobTitle ? "pt-2" : undefined}>
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
        <Field className={!includeJobTitle ? "pt-2" : undefined}>
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
      <div
        className={
          createLayout
            ? "grid grid-cols-2 gap-4"
            : !includeJobTitle
              ? "grid grid-cols-1 gap-4"
              : "grid gap-4 sm:grid-cols-2"
        }
        data-employee-form-row={createLayout ? "contact" : undefined}
      >
        {includeEmail && createLayout ? (
          <Field className={!includeJobTitle ? "pt-2" : undefined}>
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
            <FieldErrors errors={state.errors?.email} />
          </Field>
        ) : null}
        <Field className={!includeJobTitle ? "pt-2" : undefined}>
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
        {includeJobTitle && !createLayout ? (
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
        ) : null}
      </div>
      {includeJobTitle && createLayout ? (
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
      ) : null}
      {!includeJobTitle ? (
        <input name="jobTitle" type="hidden" value={values.jobTitle} />
      ) : null}
      {includeAvatar && !createLayout ? (
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
  createLayout = false,
  employee,
  externalDirty = false,
  formId,
  fullWidthSubmit = false,
  includeAvatar = true,
  includeJobTitle = true,
  returnHref = "/dashboard/employees",
  returnLabel = "Back to employees",
  onSuccess,
  showExternalAvatarErrors = false,
  showDestinationLink = true,
  showReturn = true,
  showSubmitWhenDirty = false,
}: {
  action: EmployeeFormAction
  canChooseRole?: boolean
  createLayout?: boolean
  employee?: EmployeeSummary
  externalDirty?: boolean
  formId?: string
  fullWidthSubmit?: boolean
  includeAvatar?: boolean
  includeJobTitle?: boolean
  onSuccess?: (state: ActionState) => void
  returnHref?: string
  returnLabel?: string
  showExternalAvatarErrors?: boolean
  showDestinationLink?: boolean
  showReturn?: boolean
  showSubmitWhenDirty?: boolean
}) {
  const [state, formAction, pending] = useActionState(
    action,
    INITIAL_ACTION_STATE
  )
  const handledSuccess = useRef<string | null>(null)
  const editing = Boolean(employee)
  const [fieldsDirty, setFieldsDirty] = useState(false)
  const [role, setRole] = useState<"employee" | "manager" | "owner">(
    (state.values?.role as "employee" | "manager" | "owner" | undefined) ??
      "employee"
  )

  useEffect(() => {
    if (state.ok && state.message && handledSuccess.current !== state.message) {
      handledSuccess.current = state.message
      setFieldsDirty(false)
      onSuccess?.(state)
    }
  }, [onSuccess, state])

  return (
    <form
      action={formAction}
      id={formId}
      onChange={(event) => {
        if (!employee) return
        const data = new FormData(event.currentTarget)
        setFieldsDirty(
          String(data.get("firstName") ?? "") !== employee.firstName ||
            String(data.get("lastName") ?? "") !== employee.lastName ||
            String(data.get("phone") ?? "") !== employee.phone ||
            String(data.get("jobTitle") ?? "") !== employee.jobTitle
        )
      }}
    >
      <FieldGroup>
        {state.message ? (
          <Alert variant={state.ok ? "default" : "destructive"}>
            <AlertDescription>
              {state.message}{" "}
              {state.destinationId && showDestinationLink ? (
                <Link
                  className="underline"
                  href={`/dashboard/employees?employee=${state.destinationId}`}
                  prefetch={false}
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
        {showExternalAvatarErrors ? (
          <FieldErrors errors={state.errors?.avatar} />
        ) : null}
        <EmployeeProfileFields
          createLayout={createLayout}
          employee={employee}
          includeAvatar={includeAvatar}
          includeJobTitle={includeJobTitle}
          state={state}
        />
        {!editing ? (
          <Field>
            <FieldLabel htmlFor="role">Role</FieldLabel>
            {canChooseRole ? (
              <Select
                name="role"
                onValueChange={(value) => {
                  if (value) {
                    setRole(value as "employee" | "manager" | "owner")
                  }
                }}
                value={role}
              >
                <SelectTrigger id="role">
                  <SelectValue>
                    {role === "employee"
                      ? "Employee"
                      : role === "manager"
                        ? "Manager"
                        : "Owner"}
                  </SelectValue>
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
        {!showSubmitWhenDirty || fieldsDirty || externalDirty ? (
          <div
            className={fullWidthSubmit ? "grid w-full" : "flex flex-wrap gap-3"}
          >
            <Button
              className={fullWidthSubmit ? "w-full" : undefined}
              disabled={pending}
              type="submit"
            >
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
                render={<Link href={returnHref} prefetch={false} />}
              >
                {returnLabel}
              </Button>
            ) : null}
          </div>
        ) : null}
      </FieldGroup>
    </form>
  )
}
