import { z } from "zod"

import { getMembershipContext } from "@/lib/auth/membership"
import { getLiveJobCards } from "@/lib/jobs/data"

export const dynamic = "force-dynamic"

const querySchema = z.object({
  ids: z
    .string()
    .min(1)
    .transform((value) => value.split(",").map(Number))
    .pipe(z.array(z.number().int().positive()).min(1).max(50))
    .transform((ids) => [...new Set(ids)]),
  scope: z.enum(["my-work", "team"]),
})

const RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
}

export async function GET(request: Request) {
  if (!(await getMembershipContext())) {
    return Response.json(
      { message: "Active membership required." },
      { headers: RESPONSE_HEADERS, status: 401 }
    )
  }

  const url = new URL(request.url)
  const parsed = querySchema.safeParse({
    ids: url.searchParams.get("ids"),
    scope: url.searchParams.get("scope"),
  })
  if (!parsed.success) {
    return Response.json(
      { message: "Choose between one and 50 valid jobs." },
      { headers: RESPONSE_HEADERS, status: 400 }
    )
  }

  try {
    return Response.json(
      await getLiveJobCards(parsed.data.ids, parsed.data.scope),
      { headers: RESPONSE_HEADERS }
    )
  } catch {
    return Response.json(
      { message: "Live jobs are temporarily unavailable." },
      { headers: RESPONSE_HEADERS, status: 503 }
    )
  }
}
