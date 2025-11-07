/**
 * OpenAI Realtime API Function Tools
 * These are JSON schemas that define the tools available to the AI agent
 */

export const tools = [
  {
    type: "function" as const,
    name: "saveLead",
    description:
      "Saves a lead to the database after collecting their information. Call this after confirming all details with the customer.",
    parameters: {
      type: "object",
      properties: {
        first_name: {
          type: "string",
          description: "Customer's first name",
        },
        last_name: {
          type: "string",
          description: "Customer's last name",
        },
        email: {
          type: "string",
          description: "Customer's email address",
        },
        phone: {
          type: "string",
          description: "Customer's phone number in E.164 format (e.g., +15551234567)",
        },
        reason: {
          type: "string",
          description: "Brief reason for the call or inquiry",
        },
        transcript: {
          type: "string",
          description: "Summary of the conversation transcript",
        },
      },
      required: ["first_name", "last_name", "email", "phone", "reason", "transcript"],
    },
  },
  {
    type: "function" as const,
    name: "searchWeb",
    description:
      "Searches the web for information. Use this when you need to look up current information or answer questions you're unsure about. Only call this once per conversation.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query to look up",
        },
      },
      required: ["query"],
    },
  },
  {
    type: "function" as const,
    name: "requestHandoff",
    description:
      "Requests a handoff to a human agent for complex issues or booking requests. Use this when the customer needs specialized help.",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Brief reason why the handoff is needed",
        },
      },
      required: ["reason"],
    },
  },
] as const

// TypeScript types for tool parameters
export type SaveLeadParams = {
  first_name: string
  last_name: string
  email: string
  phone: string
  reason: string
  transcript: string
}

export type SaveLeadResult = {
  lead_id: string
}

export type SearchWebParams = {
  query: string
}

export type SearchWebResult = {
  results: Array<{
    title: string
    url: string
    summary: string
  }>
}

export type RequestHandoffParams = {
  reason: string
}

export type RequestHandoffResult = {
  ticket_id: string
}
