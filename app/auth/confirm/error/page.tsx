import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function Page() {
  return (
    <main className="flex min-h-svh items-center justify-center p-6 md:p-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            <h1>Invitation link unavailable</h1>
          </CardTitle>
          <CardDescription>
            This link is invalid, expired, or has already been used.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            Contact your organisation owner for help with your invitation.
          </p>
          <Button nativeButton={false} render={<Link href="/login" />}>
            Return to sign in
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
