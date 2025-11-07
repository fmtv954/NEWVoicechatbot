import { type NextRequest, NextResponse } from "next/server"
import { pushEvent } from "@/lib/calls"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { query, call_id } = body

    // Validate query
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Missing or invalid query" }, { status: 400 })
    }

    if (call_id) {
      await pushEvent({
        call_id,
        type: "tool_called",
        payload: {
          tool: "searchWeb",
          query,
        },
      })
    }

    // Check for Tavily API key
    const tavilyApiKey = process.env.TAVILY_API_KEY
    if (!tavilyApiKey) {
      console.error("[searchWeb] TAVILY_API_KEY not configured")
      return NextResponse.json({ error: "Search service not configured" }, { status: 500 })
    }

    // Call Tavily API
    const tavilyResponse = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: tavilyApiKey,
        query,
        include_answer: false,
        include_raw_content: false,
        max_results: 3,
      }),
    })

    if (!tavilyResponse.ok) {
      const errorText = await tavilyResponse.text()
      console.error("[searchWeb] Tavily API error:", tavilyResponse.status, errorText)
      return NextResponse.json({ error: "Search failed" }, { status: 500 })
    }

    const tavilyData = await tavilyResponse.json()

    // Transform Tavily response to our format
    const results = (tavilyData.results || []).map((result: any) => ({
      title: result.title || "",
      url: result.url || "",
      summary: result.content || "",
    }))

    return NextResponse.json({ results })
  } catch (error) {
    console.error("[searchWeb] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
