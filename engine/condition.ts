// src/lib/campaigns_automation/condition.ts

import { createAdminClient } from "@/lib/supabase/admin";
import { hasDuplicateLog } from "./log";
import type { EligibleCustomer } from "./trigger";

/**
 * ============================================================
 * CONDITION RESULT
 * ============================================================
 *
 * Every condition function returns this object.
 *
 * eligible: true
 *   → The next step is allowed to continue.
 *
 * eligible: false
 *   → The engine should stop/skip this item.
 *
 * reason:
 *   → Explains why the condition failed.
 */
export interface ConditionResult {
  eligible: boolean;
  reason?: string;
}

/**
 * ============================================================
 * GLOBAL AUTOMATION CONDITION
 * ============================================================
 *
 * This runs FIRST for each restaurant.
 *
 * The purpose of this function is NOT to find customers.
 *
 * It only checks whether the restaurant's automation system
 * is allowed to run.
 *
 * Flow:
 *
 * engine.ts
 *    ↓
 * checkGlobalAutomationCondition()
 *    ↓
 * Is there an automation settings row?
 *    ↓
 * Is enabled = true?
 *    ↓
 * YES → continue
 * NO  → stop restaurant
 */
export async function checkGlobalAutomationCondition(
  restaurantId: string,
): Promise<ConditionResult> {

  /**
   * ----------------------------------------------------------
   * 1. VALIDATE RESTAURANT ID
   * ----------------------------------------------------------
   *
   * We cannot query the database without a restaurant ID.
   *
   * This also prevents accidental queries with an empty value.
   */
  if (!restaurantId) {
    return {
      eligible: false,
      reason: "INVALID_RESTAURANT_ID",
    };
  }

  /**
   * ----------------------------------------------------------
   * 2. CREATE ADMIN SUPABASE CLIENT
   * ----------------------------------------------------------
   *
   * The automation engine runs from the server/cron.
   *
   * It does not depend on a logged-in browser user.
   *
   * Therefore we use the admin client here as well.
   *
   * IMPORTANT:
   * createAdminClient() must ONLY be used in server-side code.
   */
  const supabase = createAdminClient();

  /**
   * ----------------------------------------------------------
   * 3. LOAD AUTOMATION SETTINGS
   * ----------------------------------------------------------
   *
   * Every restaurant should have ONE row in:
   *
   * automatic_campaign_settings
   *
   * restaurant_id is unique in that table.
   *
   * We only need the ID and master enabled flag here.
   */
  const {
    data: settings,
    error,
  } = await supabase
    .from("automatic_campaign_settings")
    .select("id, restaurant_id, enabled")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  /**
   * ----------------------------------------------------------
   * 4. DATABASE ERROR
   * ----------------------------------------------------------
   *
   * If Supabase itself failed, we should NOT assume the
   * automation is disabled.
   *
   * Instead, safely stop this restaurant.
   */
  if (error) {
    console.error(
      `[condition.ts] Failed to check automation settings for restaurant ${restaurantId}:`,
      error,
    );

    return {
      eligible: false,
      reason: "SETTINGS_CHECK_FAILED",
    };
  }

  /**
   * ----------------------------------------------------------
   * 5. SETTINGS ROW DOES NOT EXIST
   * ----------------------------------------------------------
   *
   * The engine found the restaurant as enabled, but if this
   * function cannot find its settings row, something is
   * inconsistent in the database.
   *
   * Do not continue.
   */
  if (!settings) {
    console.log(
      `[condition.ts] No automation settings found for restaurant ${restaurantId}`,
    );

    return {
      eligible: false,
      reason: "AUTOMATION_SETTINGS_NOT_FOUND",
    };
  }

  /**
   * ----------------------------------------------------------
   * 6. MASTER AUTOMATION TOGGLE
   * ----------------------------------------------------------
   *
   * This is the main ON/OFF switch:
   *
   * automatic_campaign_settings.enabled
   *
   * true  → automation may continue
   * false → automation must stop
   *
   * This check happens BEFORE scheduler.ts and trigger.ts.
   */
  if (settings.enabled !== true) {
    console.log(
      `[condition.ts] Automation disabled for restaurant ${restaurantId}`,
    );

    return {
      eligible: false,
      reason: "AUTOMATION_DISABLED",
    };
  }

  /**
   * ----------------------------------------------------------
   * 7. GLOBAL CONDITIONS PASSED
   * ----------------------------------------------------------
   *
   * The restaurant has:
   *
   * ✓ Valid restaurant ID
   * ✓ Automation settings
   * ✓ enabled = true
   *
   * The engine can now continue to scheduler.ts.
   */
  return {
    eligible: true,
  };
}

/**
 * ============================================================
 * CUSTOMER AUTOMATION CONDITION
 * ============================================================
 *
 * This function runs AFTER trigger.ts has found a customer
 * whose event matches the automation.
 *
 * Example:
 *
 * scheduler.ts
 *      ↓
 * "Birthday is today"
 *      ↓
 * trigger.ts
 *      ↓
 * "John has birthday today"
 *      ↓
 * checkCustomerAutomationCondition()
 *      ↓
 * "Can John actually receive this?"
 *
 * This is DIFFERENT from the global condition above.
 */
export async function checkCustomerAutomationCondition(
  customer: EligibleCustomer,
): Promise<ConditionResult> {

  /**
   * ----------------------------------------------------------
   * 1. CUSTOMER ID VALIDATION
   * ----------------------------------------------------------
   *
   * Every automation recipient must have a valid customer ID.
   */
  if (!customer.customerId) {
    return {
      eligible: false,
      reason: "INVALID_CUSTOMER_ID",
    };
  }

  /**
   * ----------------------------------------------------------
   * 2. RESTAURANT ID VALIDATION
   * ----------------------------------------------------------
   *
   * Every customer must belong to a restaurant.
   *
   * This is also important because automation logs and
   * campaign settings are restaurant-specific.
   */
  if (!customer.restaurantId) {
    return {
      eligible: false,
      reason: "INVALID_RESTAURANT_ID",
    };
  }

  /**
   * ----------------------------------------------------------
   * 3. TEMPLATE VALIDATION
   * ----------------------------------------------------------
   *
   * trigger.ts should already determine which template belongs
   * to this trigger.
   *
   * Example:
   *
   * birthday → birthday template ID
   * anniversary → anniversary template ID
   *
   * Without a template we should not send anything.
   */
  if (!customer.templateId) {
    return {
      eligible: false,
      reason: "NO_TEMPLATE_CONFIGURED",
    };
  }

  /**
   * ----------------------------------------------------------
   * 4. GET SELECTED CHANNELS
   * ----------------------------------------------------------
   *
   * channels comes from:
   *
   * automatic_campaign_settings.channels
   *
   * Example:
   *
   * ["whatsapp"]
   *
   * or:
   *
   * ["email", "whatsapp", "sms"]
   *
   * If the value is missing, safely treat it as empty.
   */
  const channels = customer.channels ?? [];

  /**
   * ----------------------------------------------------------
   * 5. EMAIL CONTACT CHECK
   * ----------------------------------------------------------
   *
   * If email is selected as a campaign channel, the customer
   * must have an email address.
   *
   * Otherwise there is nowhere to send the email.
   */
  if (channels.includes("email") && !customer.email) {
    return {
      eligible: false,
      reason: "EMAIL_REQUIRED_BUT_CUSTOMER_HAS_NO_EMAIL",
    };
  }

  /**
   * ----------------------------------------------------------
   * 6. WHATSAPP CONTACT CHECK
   * ----------------------------------------------------------
   *
   * WhatsApp currently requires a phone number.
   *
   * Your WhatsApp marketing opt-in system is not finished yet,
   * so we are NOT checking opt-in here yet.
   *
   * That check can be added later when your WhatsApp sender
   * and customer opt-in field are ready.
   */
  if (channels.includes("whatsapp") && !customer.phone) {
    return {
      eligible: false,
      reason: "WHATSAPP_REQUIRED_BUT_CUSTOMER_HAS_NO_PHONE",
    };
  }

  /**
   * ----------------------------------------------------------
   * 7. SMS CONTACT CHECK
   * ----------------------------------------------------------
   *
   * SMS also requires a phone number.
   */
  if (channels.includes("sms") && !customer.phone) {
    return {
      eligible: false,
      reason: "SMS_REQUIRED_BUT_CUSTOMER_HAS_NO_PHONE",
    };
  }

  /**
   * ----------------------------------------------------------
   * 8. WHATSAPP MARKETING OPT-IN
   * ----------------------------------------------------------
   *
   * TODO:
   *
   * Add this when the WhatsApp marketing opt-in field exists.
   *
   * Example future implementation:
   *
   * if (
   *   channels.includes("whatsapp") &&
   *   !customer.whatsappMarketingOptIn
   * ) {
   *   return {
   *     eligible: false,
   *     reason: "WHATSAPP_MARKETING_OPTED_OUT",
   *   };
   * }
   *
   * We intentionally leave it disabled for now because the
   * opt-in system has not been implemented yet.
   */

  /**
   * ----------------------------------------------------------
   * 9. DUPLICATE CAMPAIGN CHECK
   * ----------------------------------------------------------
   *
   * This is the safety mechanism that prevents the same
   * customer from receiving the same automation repeatedly.
   *
   * log.ts checks the automation_logs table.
   *
   * We currently check the last 24 hours.
   *
   * Example:
   *
   * Birthday campaign sent at 10:00 AM
   *       ↓
   * automation_logs records it
   *       ↓
   * cron runs again 6 hours later
   *       ↓
   * hasDuplicateLog() returns true
   *       ↓
   * campaign is skipped
   */
  const alreadySent = await hasDuplicateLog(
    customer.customerId,
    customer.triggerType,
    24,
  );

  /**
   * If the log says this automation was already sent,
   * do not send it again.
   */
  if (alreadySent) {
    return {
      eligible: false,
      reason: "AUTOMATION_ALREADY_SENT",
    };
  }

  /**
   * ----------------------------------------------------------
   * 10. CUSTOMER PASSED ALL CONDITIONS
   * ----------------------------------------------------------
   *
   * At this point:
   *
   * ✓ Customer ID exists
   * ✓ Restaurant ID exists
   * ✓ Template exists
   * ✓ Required contact information exists
   * ✓ No duplicate automation was detected
   *
   * The engine can now load the template and send the
   * campaign through actions.ts / the sender.
   */
  return {
    eligible: true,
  };
}