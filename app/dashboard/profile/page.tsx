import { ProfileScreen } from "@/components/profile/profile-screen"
import { getCurrentProfile } from "@/lib/employees/data"

export default async function Page() {
  const profile = await getCurrentProfile()

  return <ProfileScreen profile={profile} />
}
