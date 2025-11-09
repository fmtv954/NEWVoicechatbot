import { PromptEditor } from "./prompt-editor"

export default function PromptEditorPage() {
  return (
    <div className="mx-auto max-w-5xl p-6 sm:p-10">
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">AI Agent Prompt Editor</h1>
          <p className="text-base text-muted-foreground">
            Customize the system instructions that control how your AI agent behaves during calls. Changes are saved to
            persistent storage and take effect immediately for new calls.
          </p>
        </header>

        <PromptEditor />
      </div>
    </div>
  )
}
