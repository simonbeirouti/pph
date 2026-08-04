export function createAvatarUrl(
  membershipId: number,
  avatarPath: string | null
): string | null {
  return avatarPath ? `/api/avatars/${membershipId}` : null
}
