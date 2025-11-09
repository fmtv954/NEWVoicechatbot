import { type NextRequest, NextResponse } from "next/server"
import { getSystemPrompt } from "@/lib/prompt"
import fs from "fs/promises"
import path from "path"

const PROMPT_FILE_PATH = path.join(process.cwd(), "data", "custom-prompt.txt")

// GET - Load current prompt
export async function GET() {
  try {
    const prompt = await getSystemPrompt()
    return NextResponse.json({ prompt })
  } catch (error) {
    console.error("[Prompt API] Failed to load prompt:", error)
    return NextResponse.json({ error: "Failed to load prompt" }, { status: 500 })
  }
}

// POST - Save new prompt
export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json()

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Invalid prompt" }, { status: 400 })
    }

    // Ensure data directory exists
    const dataDir = path.join(process.cwd(), "data")
    await fs.mkdir(dataDir, { recursive: true })

    // Write prompt to file
    await fs.writeFile(PROMPT_FILE_PATH, prompt, "utf-8")

    console.log("[Prompt API] ✅ Prompt saved successfully")
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Prompt API] Failed to save prompt:", error)
    return NextResponse.json({ error: "Failed to save prompt" }, { status: 500 })
  }
}
