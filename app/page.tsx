import Link from "next/link"

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bold text-gray-900">Voice AI Call Widget POC</h1>
          <p className="text-xl text-gray-600">
            Browser-based voice agent with lead capture, web search, and human handoff
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 space-y-6">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-900">Features</h2>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">✓</span>
                Natural conversation with low latency and barge-in
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">✓</span>
                Lead capture with read-back confirmation
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">✓</span>
                Web search fallback for unknown questions
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">✓</span>
                Human handoff via SMS + LiveKit
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">✓</span>
                Privacy-first: transcripts only, no audio recording
              </li>
            </ul>
          </div>

          <div className="pt-4">
            <Link
              href="/demo"
              className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Try Demo
            </Link>
          </div>
        </div>

        <div className="text-center text-sm text-gray-500">
          <p>Built with Next.js 14, OpenAI Realtime, LiveKit, and Supabase</p>
        </div>
      </div>
    </main>
  )
}
