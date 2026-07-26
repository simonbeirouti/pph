import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"

export default async function Page() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()

  redirect(data?.claims.sub ? "/dashboard" : "/login")
}
