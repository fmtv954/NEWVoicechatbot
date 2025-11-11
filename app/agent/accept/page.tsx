import { Suspense } from "react"
import AcceptHandoffClient from "./accept-handoff-client"
import { Loader2 } from "lucide-react"

export const metadata = {
  title: "Accept Handoff | Voice AI Widget",
  description: "Accept incoming call handoff from AI agent",
}

export default function AcceptHandoffPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      }
    >
      <AcceptHandoffClient />
    </Suspense>
  )
}
