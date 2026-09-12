// src/lib/campaigns_automation/log.ts

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Checks whether this customer has already received
 * this automation within the lookback window.
 */
export async function hasDuplicateLog(
  customerId: string,
  triggerTypeId: string,
  lookbackHours: number = 24,
): Promise<boolean> {
  const supabase = await createAdminClient();

  const cutoffDate = new Date(
    Date.now() - lookbackHours * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await supabase
    .from("automation_logs")
    .select("id")
    .eq("customer_id", customerId)
    .eq("trigger_type_id", triggerTypeId)
    .gte("created_at", cutoffDate)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      `[log.ts] Failed duplicate check for customer ${customerId}:`,
      error,
    );

    // Fail closed.
    //
    // If we cannot determine whether the customer was already
    // contacted, do NOT send another automated message.
    throw error;
  }

  return data !== null;
}