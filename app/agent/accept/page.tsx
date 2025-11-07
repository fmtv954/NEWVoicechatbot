import { Suspense } from "react"
import AcceptHandoffClient from "./accept-handoff-client"

export default function AcceptHandoffPage() {
  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
        <AcceptHandoffClient />
      </Suspense>
    </div>
  )
}
