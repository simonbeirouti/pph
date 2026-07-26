export type ActionState = {
  destinationId?: number
  errors?: Record<string, string[]>
  invitation?: "sent" | "failed"
  membershipStatus?: "invited" | "active" | "inactive"
  message?: string
  ok: boolean
  values?: Record<string, string>
  warnings?: string[]
}

export const INITIAL_ACTION_STATE: ActionState = { ok: false }
