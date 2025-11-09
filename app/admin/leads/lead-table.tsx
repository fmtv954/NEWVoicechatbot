'use client'

import { useMemo, useState } from 'react'
import { Download, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { sanitizeEmail, sanitizePhone, sanitizePlainText } from '@/lib/text'

import { useLiveLeads } from '@/hooks/useLiveLeads'

import type { LeadRecord } from './types'

interface LeadTableProps {
  initialLeads: LeadRecord[]
}

interface NormalizedLead {
  id: string
  createdAt: string
  campaignName: string
  agentName: string
  firstName: string
  lastName: string
  email: string
  phone: string
  reason: string
  transcript: string
  normalizedName: string
  normalizedEmail: string
  normalizedPhone: string
  normalizedReason: string
  createdAtLabel: string
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function toNormalizedLead(lead: LeadRecord): NormalizedLead {
  const safeFirstName = sanitizePlainText(lead.firstName ?? undefined, { maxLength: 128 })
  const safeLastName = sanitizePlainText(lead.lastName ?? undefined, { maxLength: 128 })
  const safeEmail = sanitizeEmail(lead.email ?? undefined, { maxLength: 320 })
  const safePhone = sanitizePhone(lead.phone ?? undefined, { maxLength: 32 })
  const safeReason = sanitizePlainText(lead.reason ?? undefined, {
    allowNewlines: true,
    maxLength: 1000,
  })
  const safeTranscript = sanitizePlainText(lead.transcript ?? undefined, {
    allowNewlines: true,
    maxLength: 8000,
  })
  const safeCampaignName = sanitizePlainText(lead.campaignName ?? undefined, { maxLength: 160 })
  const safeAgentName = sanitizePlainText(lead.agentName ?? undefined, { maxLength: 160 })

  return {
    id: lead.id,
    createdAt: lead.createdAt,
    campaignName: safeCampaignName ?? '',
    agentName: safeAgentName ?? '',
    firstName: safeFirstName ?? '',
    lastName: safeLastName ?? '',
    email: safeEmail ?? '',
    phone: safePhone ?? '',
    reason: safeReason ?? '',
    transcript: safeTranscript ?? '',
    normalizedName: [safeFirstName, safeLastName]
      .filter((part) => Boolean(part && part.trim().length > 0))
      .join(' ')
      .toLowerCase(),
    normalizedEmail: (safeEmail ?? '').toLowerCase(),
    normalizedPhone: (safePhone ?? '').replace(/[^0-9a-zA-Z+]/g, ''),
    normalizedReason: (safeReason ?? '').toLowerCase(),
    createdAtLabel: dateFormatter.format(new Date(lead.createdAt)),
  }
}

function matchesQuery(lead: NormalizedLead, query: string) {
  if (!query) {
    return true
  }

  const normalizedQuery = query.toLowerCase()

  return (
    lead.normalizedName.includes(normalizedQuery) ||
    lead.normalizedEmail.includes(normalizedQuery) ||
    lead.normalizedPhone.includes(normalizedQuery.replace(/[^0-9a-zA-Z+]/g, '')) ||
    lead.normalizedReason.includes(normalizedQuery)
  )
}

export function LeadTable({ initialLeads }: LeadTableProps) {
  const [query, setQuery] = useState('')
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null)
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null)

  const { leads, error: liveError, isRefreshing } = useLiveLeads(initialLeads)

  const normalizedLeads = useMemo(() => leads.map((lead) => toNormalizedLead(lead)), [leads])

  const activeLead = useMemo(
    () => normalizedLeads.find((lead) => lead.id === activeLeadId) ?? null,
    [activeLeadId, normalizedLeads]
  )

  const campaignOptions = useMemo(() => {
    const options = new Map<string, string>()
    for (const lead of normalizedLeads) {
      if (lead.campaignName) {
        options.set(lead.campaignName, lead.campaignName)
      }
    }
    return Array.from(options.values()).sort((a, b) => a.localeCompare(b))
  }, [normalizedLeads])

  const filteredLeads = useMemo(() => {
    return normalizedLeads.filter((lead) => {
      const matchesCampaign = !selectedCampaign || lead.campaignName === selectedCampaign
      return matchesCampaign && matchesQuery(lead, query)
    })
  }, [normalizedLeads, selectedCampaign, query])

  function handleExportCsv() {
    if (filteredLeads.length === 0) {
      return
    }

    const header = [
      'Created At',
      'Campaign',
      'Agent',
      'First Name',
      'Last Name',
      'Email',
      'Phone',
      'Reason',
      'Transcript',
    ]

    const rows = filteredLeads.map((lead) => [
      lead.createdAtLabel,
      lead.campaignName,
      lead.agentName,
      lead.firstName,
      lead.lastName,
      lead.email,
      lead.phone,
      lead.reason,
      lead.transcript,
    ])

    const csvContent = [header, ...rows]
      .map((row) =>
        row
          .map((value) => {
            if (!value) {
              return ''
            }
            const normalized = String(value).replace(/"/g, '""').replace(/\r?\n/g, ' ')
            return `"${normalized}"`
          })
          .join(',')
      )
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="gap-2">
        <div className="flex flex-col gap-1">
          <CardTitle>Leads</CardTitle>
          <CardDescription>
            Review captured leads, search by contact info, and export results.
          </CardDescription>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 items-center gap-2">
            <div className="relative w-full md:max-w-sm">
              <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
              <Input
                placeholder="Search by name, email, phone, or reason"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-9"
                aria-label="Search leads"
              />
            </div>
            <select
              value={selectedCampaign ?? ''}
              onChange={(event) => setSelectedCampaign(event.target.value || null)}
              className="border-input focus-visible:ring-ring text-sm ring-offset-background flex h-10 items-center rounded-md border bg-background px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              aria-label="Filter by campaign"
            >
              <option value="">All campaigns</option>
              {campaignOptions.map((campaign) => (
                <option key={campaign} value={campaign}>
                  {campaign}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-end text-right">
              <p className="text-muted-foreground text-sm">
                Showing{' '}
                <span className="font-semibold text-foreground">{filteredLeads.length}</span> of{' '}
                {normalizedLeads.length}
                {isRefreshing ? <span className="ml-2 text-xs">Updating…</span> : null}
              </p>
              {liveError ? (
                <p className="text-destructive text-xs">Live updates paused: {liveError}</p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={filteredLeads.length === 0}
            >
              <Download className="mr-2 size-4" /> Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead>
            <tr className="text-muted-foreground text-left">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Campaign</th>
              <th className="px-4 py-3 font-medium">Agent</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Reason</th>
              <th className="px-4 py-3 font-medium">Transcript</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredLeads.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  No leads match your filters yet.
                </td>
              </tr>
            ) : (
              filteredLeads.map((lead) => {
                const customerName =
                  [lead.firstName, lead.lastName].filter(Boolean).join(' ') || '–'
                const contactLines = [lead.email, lead.phone].filter((value) =>
                  Boolean(value && value.length > 0)
                )
                const reasonPreview = lead.reason.slice(0, 80)
                const hasTranscript = Boolean(lead.transcript && lead.transcript.length > 0)
                const shouldShowPreview = hasTranscript && lead.transcript.length <= 160
                const transcriptPreview = lead.transcript.slice(0, 80)

                return (
                  <tr key={lead.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3 align-top text-muted-foreground whitespace-nowrap">
                      {lead.createdAtLabel}
                    </td>
                    <td className="px-4 py-3 align-top font-medium">{lead.campaignName || '–'}</td>
                    <td className="px-4 py-3 align-top text-muted-foreground">
                      {lead.agentName || '–'}
                    </td>
                    <td className="px-4 py-3 align-top font-medium">{customerName}</td>
                    <td className="px-4 py-3 align-top">
                      {contactLines.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {contactLines.map((value) => (
                            <span key={value} className="break-all text-muted-foreground">
                              {value}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className="line-clamp-2 text-muted-foreground">
                        {reasonPreview || '–'}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      {hasTranscript ? (
                        shouldShowPreview ? (
                          <button
                            type="button"
                            onClick={() => setActiveLeadId(lead.id)}
                            className="line-clamp-2 text-left text-muted-foreground underline-offset-4 hover:underline"
                            aria-label="View transcript"
                          >
                            {transcriptPreview}
                            {lead.transcript.length > transcriptPreview.length ? '…' : ''}
                          </button>
                        ) : (
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="px-0"
                            onClick={() => setActiveLeadId(lead.id)}
                          >
                            View transcript
                          </Button>
                        )
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setActiveLeadId(lead.id)}
                      >
                        View details
                      </Button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </CardContent>

      <Dialog open={Boolean(activeLead)} onOpenChange={(open) => !open && setActiveLeadId(null)}>
        {activeLead && (
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Lead details</DialogTitle>
              <DialogDescription>
                Captured on {activeLead.createdAtLabel}
                {activeLead.campaignName ? ` · ${activeLead.campaignName}` : ''}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Customer
                </h3>
                <p className="mt-1 text-base font-medium">
                  {[activeLead.firstName, activeLead.lastName].filter(Boolean).join(' ') ||
                    'Unknown'}
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Email
                  </h4>
                  <p className="mt-1 break-all text-sm">{activeLead.email || '–'}</p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Phone
                  </h4>
                  <p className="mt-1 break-all text-sm">{activeLead.phone || '–'}</p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Reason
                </h4>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                  {activeLead.reason || '–'}
                </p>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Transcript
                </h4>
                {activeLead.transcript ? (
                  <ScrollArea className="max-h-64 rounded-md border">
                    <pre className="whitespace-pre-wrap break-words p-4 text-sm leading-relaxed">
                      {activeLead.transcript}
                    </pre>
                  </ScrollArea>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    No transcript stored for this lead.
                  </p>
                )}
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </Card>
  )
}
