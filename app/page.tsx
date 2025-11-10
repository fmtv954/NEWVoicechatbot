import Link from "next/link"

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-4 text-center">
          <h1 className="text-5xl font-bold text-gray-900">Voice AI Call Widget</h1>
          <p className="text-xl text-gray-600">Browser-based voice agent with lead capture and human handoff</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Link
            href="/demo"
            className="rounded-lg border border-gray-200 bg-white p-6 shadow-lg transition-all hover:scale-105 hover:shadow-xl"
          >
            <h2 className="mb-2 text-2xl font-semibold text-gray-900">Demo Test</h2>
            <p className="text-gray-600">Try the voice AI call widget with a test conversation</p>
          </Link>

          <Link
            href="/admin/leads"
            className="rounded-lg border border-gray-200 bg-white p-6 shadow-lg transition-all hover:scale-105 hover:shadow-xl"
          >
            <h2 className="mb-2 text-2xl font-semibold text-gray-900">View Leads</h2>
            <p className="text-gray-600">See all captured leads from customer conversations</p>
          </Link>

          <Link
            href="/admin/dev"
            className="rounded-lg border border-gray-200 bg-white p-6 shadow-lg transition-all hover:scale-105 hover:shadow-xl"
          >
            <h2 className="mb-2 text-2xl font-semibold text-gray-900">Create Campaign</h2>
            <p className="text-gray-600">Set up new campaigns with custom configurations</p>
          </Link>

          <Link
            href="/api/test/slack-lead"
            className="rounded-lg border border-gray-200 bg-white p-6 shadow-lg transition-all hover:scale-105 hover:shadow-xl"
          >
            <h2 className="mb-2 text-2xl font-semibold text-gray-900">Test Slack</h2>
            <p className="text-gray-600">Send the most recent lead to Slack for testing</p>
          </Link>

          <Link
            href="/admin/prompt"
            className="rounded-lg border border-gray-200 bg-white p-6 shadow-lg transition-all hover:scale-105 hover:shadow-xl"
          >
            <h2 className="mb-2 text-2xl font-semibold text-gray-900">AI Prompt</h2>
            <p className="text-gray-600">View and manage the AI agent system prompt</p>
          </Link>
        </div>

        <div className="text-center text-sm text-gray-500">
          <p>Built with Next.js, OpenAI Realtime, LiveKit, and Supabase</p>
        </div>
      </div>
    </main>
  )
}
