import { AlertTriangle } from 'lucide-react'

import { LeadTable } from './lead-table'
import { fetchAdminLeads } from './queries'
import type { LeadRecord } from './types'
import { Card, CardContent } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

export default async function AdminLeadsPage() {
  const { leads, error } = await fetchAdminLeads()

  return (
    <div className="min-h-screen bg-background p-6 sm:p-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Lead Management</h1>
          <p className="text-muted-foreground text-base">
            Monitor captured leads, review transcripts, and export contact details for follow-up.
          </p>
        </header>

        {error ? (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex items-start gap-3 p-6">
              <AlertTriangle className="text-destructive mt-1 size-5 flex-shrink-0" />
              <div>
                <p className="font-medium text-destructive">{error}</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Check your Supabase configuration and try again.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <LeadTable initialLeads={leads} />
        )}
      </div>
    </div>
  )
}
