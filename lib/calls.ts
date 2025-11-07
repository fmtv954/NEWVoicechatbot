import { supabaseAdmin } from "./supabaseAdmin"

/**
 * Call event types that are logged throughout the call lifecycle
 */
export type CallEventType =
  | "call_started"
  | "first_ai_audio"
  | "barge_in"
  | "tool_called"
  | "function_call_invoked"
  | "tool_result_returned"
  | "lead_saved"
  | "handoff_requested"
  | "sms_sent"
  | "handoff_accepted"
  | "handoff_timeout"
  | "call_ended"
  | "livekit_joined"
  | "livekit_left"

/**
 * Start a new call and insert into database
 * Returns the call_id to be used for subsequent events
 */
export async function startCall(params: { agent_id: string; campaign_id: string }): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("calls")
      .insert({
        agent_id: params.agent_id,
        campaign_id: params.campaign_id,
        status: "active",
      })
      .select("id")
      .single()

    if (error) {
      console.error("[startCall] Failed to insert call:", error)
      return null
    }

    // Log call_started event
    await pushEvent({
      call_id: data.id,
      type: "call_started",
      payload: {
        agent_id: params.agent_id,
        campaign_id: params.campaign_id,
      },
    })

    return data.id
  } catch (error) {
    console.error("[startCall] Error:", error)
    return null
  }
}

/**
 * Push an event to the call_events table
 */
export async function pushEvent(params: {
  call_id: string
  type: CallEventType
  payload?: Record<string, any>
}): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin.from("call_events").insert({
      call_id: params.call_id,
      type: params.type,
      payload_json: params.payload || {},
    })

    if (error) {
      console.error(`[pushEvent] Failed to insert ${params.type} event:`, error)
      return false
    }

    return true
  } catch (error) {
    console.error(`[pushEvent] Error logging ${params.type}:`, error)
    return false
  }
}

/**
 * End a call and update its status
 */
export async function endCall(params: { call_id: string; duration_seconds?: number }): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from("calls")
      .update({
        status: "completed",
        ended_at: new Date().toISOString(),
      })
      .eq("id", params.call_id)

    if (error) {
      console.error("[endCall] Failed to update call:", error)
      return false
    }

    // Log call_ended event
    await pushEvent({
      call_id: params.call_id,
      type: "call_ended",
      payload: {
        duration_seconds: params.duration_seconds,
      },
    })

    return true
  } catch (error) {
    console.error("[endCall] Error:", error)
    return false
  }
}
