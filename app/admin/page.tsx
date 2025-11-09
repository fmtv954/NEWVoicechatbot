import Link from 'next/link'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const adminSections = [
  {
    href: '/admin/leads',
    title: 'Leads',
    description: 'Review captured leads, filter by campaign, and export contact details.',
  },
  {
    href: '/admin/dev',
    title: 'Create Campaign',
    description: 'Seed demo campaigns and fetch embed details in development environments.',
  },
]

export default function AdminIndexPage() {
  return (
    <main className="min-h-screen bg-background p-6 sm:p-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Admin Tools</h1>
          <p className="text-muted-foreground text-base">
            Jump to lead management or the development campaign tools.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          {adminSections.map((section) => (
            <Card key={section.href} className="transition-colors hover:border-primary/50">
              <Link href={section.href} className="block">
                <CardHeader>
                  <CardTitle>{section.title}</CardTitle>
                  <CardDescription>{section.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Open {section.title.toLowerCase()} tools
                  </p>
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}
