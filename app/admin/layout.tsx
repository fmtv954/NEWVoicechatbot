import type React from "react"
import { FileText, Users, Wrench, MessageSquare } from "lucide-react"
import Link from "next/link"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Admin Navigation Bar */}
      <nav className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-lg font-semibold">
              Voice AI Admin
            </Link>
            <div className="flex items-center gap-1">
              <Link
                href="/admin/leads"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Users className="h-4 w-4" />
                Leads
              </Link>
              <Link
                href="/admin/prompt"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <MessageSquare className="h-4 w-4" />
                Prompt Editor
              </Link>
              <Link
                href="/admin/test-slack"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <FileText className="h-4 w-4" />
                Test Slack
              </Link>
              <Link
                href="/admin/dev"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Wrench className="h-4 w-4" />
                Dev Tools
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      {children}
    </div>
  )
}
