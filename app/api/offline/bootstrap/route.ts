import { buildOfflineV2Snapshot } from "@/lib/offline-v2/bootstrap"
import { getMembershipContext } from "@/lib/auth/membership"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    if (!(await getMembershipContext())) {
      return Response.json(
        { message: "Active membership required." },
        { status: 401 }
      )
    }
    const snapshot = await buildOfflineV2Snapshot()
    return Response.json(snapshot, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        Vary: "Cookie",
      },
    })
  } catch (error) {
    console.error("Offline bootstrap failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    })
    return Response.json(
      { message: "Unable to prepare this device for offline use." },
      {
        headers: { "Cache-Control": "private, no-store, max-age=0" },
        status: 503,
      }
    )
  }
}
