export default function DemoPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-gray-50">
      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gray-900">Demo Call UI</h1>
          <p className="text-gray-600">Test the voice AI call experience</p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center space-y-4">
            <div className="text-gray-500">Call UI will be implemented here</div>
            <p className="text-sm text-gray-400">Widget + Call Interface Coming Soon</p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Privacy Notice:</strong> Transcripts only; no audio recorded.
          </p>
        </div>
      </div>
    </main>
  )
}
