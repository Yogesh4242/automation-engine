// src/lib/campaigns_automation/engine.ts

import { createAdminClient } from "@/lib/supabase/admin";

import type {
  EligibleCustomer,
  TriggerType,
} from "./trigger";

import {
  checkGlobalAutomationCondition,
  checkCustomerAutomationCondition,
} from "./condition";

import {
  runScheduler,
} from "./scheduler";

import {
  getDefaultTemplates,
} from "./config";


/* ============================================================
   TYPES
   ============================================================ */

/**
 * Represents the result of processing one customer.
 */
export interface SendResult {
  customerId: string;

  triggerType: TriggerType;

  channel: string;

  outcome:
    | "SENT"
    | "FAILED"
    | "SKIPPED";

  reason?: string;
}


/**
 * Represents the complete result of one automation-engine run.
 */
export interface AutomationRunResult {
  success: boolean;

  restaurantsProcessed: number;

  customersProcessed: number;

  sent: number;

  skipped: number;

  failed: number;

  results: SendResult[];
}


/* ============================================================
   LOCAL CAMPAIGN TEMPLATE
   ============================================================ */

/**
 * This is the internal template format used by the sender.
 *
 * IMPORTANT:
 *
 * These templates come from:
 *
 *   ./config.ts
 *
 * They do NOT come from Supabase.
 *
 * Therefore template IDs such as:
 *
 *   birthday_default
 *   anniversary_default
 *
 * are valid local IDs and do NOT need to be UUIDs.
 */
interface CampaignTemplate {
  id: string;

  automationCategory: string;

  title: string;

  discount?: string;

  category?: string;

  occasion?: string;

  imageUrl?: string;

  summary?: string;

  audience?: string;

  channel?: string;

  timing?: string;
}


/* ============================================================
   FIND LOCAL TEMPLATE
   ============================================================ */

/**
 * Finds a template from config.ts.
 *
 * The trigger.ts file gives us a template ID such as:
 *
 *   birthday_default
 *
 * We look that ID up in the local template configuration.
 *
 * We DO NOT query campaign_templates in Supabase.
 */
function getLocalTemplate(
  templateId: string,
): CampaignTemplate | null {

  const templates =
    getDefaultTemplates() as CampaignTemplate[];


  const template =
    templates.find(
      item =>
        item.id === templateId,
    );


  if (!template) {

    console.error(
      `[ENGINE] Local template not found: ${templateId}`,
    );

    return null;
  }


  console.log(
    `[ENGINE] Loaded local template: ${templateId}`,
  );


  return template;
}


/* ============================================================
   SEND WHATSAPP
   ============================================================ */

/**
 * Sends the automation through your existing
 * WhatsApp API route.
 *
 * The actual WhatsApp implementation stays outside
 * of the automation engine.
 */
async function sendWhatsApp(
  customer: EligibleCustomer,
  template: CampaignTemplate,
): Promise<void> {

  /* ----------------------------------------------------------
     CUSTOMER PHONE VALIDATION
     ---------------------------------------------------------- */

  if (!customer.phone) {

    throw new Error(
      "CUSTOMER_HAS_NO_PHONE",
    );
  }


  /* ----------------------------------------------------------
     SITE URL
     ---------------------------------------------------------- */

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL;


  if (!siteUrl) {

    throw new Error(
      "NEXT_PUBLIC_SITE_URL_NOT_CONFIGURED",
    );
  }


  /* ----------------------------------------------------------
     BUILD MESSAGE
     ---------------------------------------------------------- */

  /**
   * The local template uses `title`.
   *
   * Example:
   *
   * "Happy Birthday! Enjoy 20% Off"
   *
   * We use that as the message sent to WhatsApp.
   */
  const message =
    template.title ||
    `Happy ${customer.triggerType}, ${customer.name}!`;


  /* ----------------------------------------------------------
     SEND REQUEST
     ---------------------------------------------------------- */

 const automationSecret =
  process.env.AUTOMATION_INTERNAL_SECRET;

if (!automationSecret) {
  throw new Error(
    "AUTOMATION_INTERNAL_SECRET_NOT_CONFIGURED",
  );
}

const response =
  await fetch(
    `${siteUrl}/api/automation-send/whatsapp`,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",

        "x-automation-secret":
          automationSecret,
      },

      body: JSON.stringify({

        to:
          customer.phone,

        message,

        templateData: {

          /**
           * Restaurant/template information.
           */
          storeName:
            template.occasion ||
            "Restaurant",

          /**
           * Template title.
           */
          title:
            template.title,

          /**
           * Discount information.
           */
          discount:
            template.discount ||
            null,

          /**
           * Template category.
           */
          category:
            template.category ||
            null,

          /**
           * Occasion.
           */
          occasion:
            template.occasion ||
            customer.triggerType,

          /**
           * Marketing summary.
           */
          summary:
            template.summary ||
            null,

          /**
           * Audience.
           */
          audience:
            template.audience ||
            null,

          /**
           * Image associated with the template.
           */
          imageUrl:
            template.imageUrl ||
            null,
        },
      }),
    },
  );


  /* ----------------------------------------------------------
     HTTP ERROR
     ---------------------------------------------------------- */

  if (!response.ok) {

    throw new Error(
      `WHATSAPP_REQUEST_FAILED_${response.status}`,
    );
  }


  /* ----------------------------------------------------------
     API RESPONSE
     ---------------------------------------------------------- */

  const result =
    await response.json();


  if (!result.success) {

    throw new Error(
      result.error ||
      "WHATSAPP_MESSAGE_FAILED",
    );
  }
}


/* ============================================================
   LOG SUCCESSFUL AUTOMATION
   ============================================================ */

/**
 * Writes a log ONLY after a message has successfully
 * been sent.
 *
 * This prevents duplicate sends on future runs.
 */
async function logSuccessfulAutomation(
  customer: EligibleCustomer,
  channel: string,
): Promise<void> {
  const supabase = await createAdminClient();

  const {
    error,
  } = await supabase
    .from("automation_logs")
    .insert({
      customer_id:
        customer.customerId,

      trigger_type_id:
        customer.triggerType,

      restaurant_id:
        customer.restaurantId,

      channel:
        channel,

      status:
        "sent",
    });

  if (error) {
    console.error(
      `[ENGINE] Failed to create automation log for ${customer.customerId}:`,
      error,
    );



    /**
     * IMPORTANT:
     *
     * The message has already been sent.
     *
     * Therefore a logging failure must NOT
     * change SENT into FAILED.
     */
  }
}


/* ============================================================
   PROCESS MATCHED CUSTOMERS
   ============================================================ */

/**
 * Processes customers returned by scheduler.ts.
 *
 * Flow:
 *
 * scheduler
 *     ↓
 * customer
 *     ↓
 * condition
 *     ↓
 * local template
 *     ↓
 * WhatsApp
 *     ↓
 * automation log
 */
export async function executeCampaignRun(
  customers: EligibleCustomer[],
): Promise<SendResult[]> {

  const results:
    SendResult[] = [];


  /* ==========================================================
     PROCESS EVERY MATCHED CUSTOMER
     ========================================================== */

  for (
    const customer of customers
  ) {

    console.log(
      `[ENGINE] Checking customer: ${customer.name}`,
    );


    /* ========================================================
       1. CUSTOMER CONDITIONS
       ======================================================== */

    /**
     * Check whether this specific customer can receive
     * the automation.
     *
     * This includes:
     *
     * - customer ID
     * - restaurant ID
     * - template
     * - contact information
     * - duplicate protection
     */
    const conditionResult =
      await checkCustomerAutomationCondition(
        customer,
      );


    /* --------------------------------------------------------
       CUSTOMER NOT ELIGIBLE
       -------------------------------------------------------- */

    if (
      !conditionResult.eligible
    ) {

      console.log(
        `[ENGINE] SKIP ${customer.name}: ${conditionResult.reason}`,
      );


      results.push({

        customerId:
          customer.customerId,

        triggerType:
          customer.triggerType,

        channel:
          "-",

        outcome:
          "SKIPPED",

        reason:
          conditionResult.reason,
      });


      continue;
    }


    console.log(
      `[ENGINE] Customer eligible: ${customer.name}`,
    );


    /* ========================================================
       2. LOAD LOCAL TEMPLATE
       ======================================================== */

    /**
     * IMPORTANT:
     *
     * customer.templateId is something like:
     *
     * birthday_default
     *
     * It is NOT a Supabase UUID.
     *
     * Therefore we load it from config.ts.
     */
    const template =
      getLocalTemplate(
        customer.templateId,
      );


    /* --------------------------------------------------------
       TEMPLATE NOT FOUND
       -------------------------------------------------------- */

    if (!template) {

      console.log(
        `[ENGINE] FAILED ${customer.name}: local template not found`,
      );


      results.push({

        customerId:
          customer.customerId,

        triggerType:
          customer.triggerType,

        channel:
          "-",

        outcome:
          "FAILED",

        reason:
          "TEMPLATE_NOT_FOUND",
      });


      continue;
    }


    /* ========================================================
       3. SEND CONFIGURED CHANNELS
       ======================================================== */

    for (
      const channel of customer.channels
    ) {


      /* ======================================================
         WHATSAPP
         ====================================================== */

      if (
        channel !== "whatsapp"
      ) {

        console.log(
          `[ENGINE] SKIP ${customer.name}: ${channel} not implemented`,
        );


        results.push({

          customerId:
            customer.customerId,

          triggerType:
            customer.triggerType,

          channel,

          outcome:
            "SKIPPED",

          reason:
            "CHANNEL_NOT_IMPLEMENTED",
        });


        continue;
      }


      /* ======================================================
         SEND MESSAGE
         ====================================================== */

      try {

        console.log(
          `[ENGINE] Sending WhatsApp → ${customer.name}`,
        );


        await sendWhatsApp(
          customer,
          template,
        );


        console.log(
          `[ENGINE] WhatsApp sent → ${customer.name}`,
        );


        /* ====================================================
           LOG AFTER SUCCESS
           ==================================================== */

        await logSuccessfulAutomation(
          customer,
          "whatsapp"
        );


        /* ====================================================
           RECORD SUCCESS
           ==================================================== */

        results.push({

          customerId:
            customer.customerId,

          triggerType:
            customer.triggerType,

          channel,

          outcome:
            "SENT",
        });


      } catch (error) {

        const reason =
          error instanceof Error
            ? error.message
            : "UNKNOWN_SEND_ERROR";


        console.error(
          `[ENGINE] Failed sending to ${customer.name}:`,
          error,
        );


        results.push({

          customerId:
            customer.customerId,

          triggerType:
            customer.triggerType,

          channel,

          outcome:
            "FAILED",

          reason,
        });
      }
    }
  }


  return results;
}


/* ============================================================
   MASTER AUTOMATION ENGINE
   ============================================================ */

/**
 * MAIN AUTOMATION ENTRY POINT.
 *
 * Production:
 *
 * CRON
 *   ↓
 * /api/cron/automation
 *   ↓
 * runAutomationEngine()
 *
 *
 * Testing:
 *
 * POST
 *   ↓
 * /api/cron/automation-test
 *   ↓
 * runAutomationEngine()
 */
export async function runAutomationEngine():
  Promise<AutomationRunResult> {

  console.log("");

  console.log(
    "================================================",
  );

  console.log(
    "[ENGINE] AUTOMATION ENGINE STARTED",
  );

  console.log(
    "================================================",
  );


  const allResults:
    SendResult[] = [];


  let restaurantsProcessed =
    0;


  let customersProcessed =
    0;


  /* ==========================================================
     1. FIND ENABLED AUTOMATIONS
     ========================================================== */

  console.log(
    "[ENGINE] 1/5 Checking automation settings...",
  );


  const supabase =
    await createAdminClient();


  const {
    data: settings,
    error: settingsError,
  } = await supabase

    .from(
      "automatic_campaign_settings",
    )

    .select(
      "restaurant_id, enabled",
    )

    .eq(
      "enabled",
      true,
    );


  /* ----------------------------------------------------------
     DATABASE ERROR
     ---------------------------------------------------------- */

  if (settingsError) {

    console.error(
      "[ENGINE] Failed to load automation settings:",
      settingsError,
    );

    throw settingsError;
  }


  /* ==========================================================
     NO ENABLED AUTOMATIONS
     ========================================================== */

  if (
    !settings ||
    settings.length === 0
  ) {

    console.log(
      "[ENGINE] No enabled automations found.",
    );


    return {

      success: true,

      restaurantsProcessed: 0,

      customersProcessed: 0,

      sent: 0,

      skipped: 0,

      failed: 0,

      results: [],
    };
  }


  console.log(
    `[ENGINE] Found ${settings.length} enabled restaurant(s)`,
  );


  /* ==========================================================
     2. PROCESS EVERY ENABLED RESTAURANT
     ========================================================== */

  for (
    const setting of settings
  ) {

    const restaurantId =
      setting.restaurant_id;


    console.log("");

    console.log(
      `[ENGINE] Restaurant: ${restaurantId}`,
    );


    /* ========================================================
       GLOBAL CONDITIONS
       ======================================================== */

    console.log(
      "[ENGINE] 2/5 Running global conditions...",
    );


    const globalCondition =
      await checkGlobalAutomationCondition(
        restaurantId,
      );


    /* --------------------------------------------------------
       GLOBAL CONDITION FAILED
       -------------------------------------------------------- */

    if (
      !globalCondition.eligible
    ) {

      console.log(
        `[ENGINE] STOP → ${globalCondition.reason}`,
      );

      continue;
    }


    console.log(
      "[ENGINE] Global conditions passed",
    );


    /* ========================================================
       SCHEDULER
       ======================================================== */

    console.log(
      "[ENGINE] 3/5 Running scheduler...",
    );


    const scheduledRuns =
      await runScheduler(
        restaurantId,
      );


    /* --------------------------------------------------------
       NOTHING DUE
       -------------------------------------------------------- */

    if (
      scheduledRuns.length === 0
    ) {

      console.log(
        "[ENGINE] No events due right now.",
      );

      continue;
    }


    console.log(
      `[ENGINE] Scheduler found ${scheduledRuns.length} scheduled run(s)`,
    );


    restaurantsProcessed++;


    /* ========================================================
       4. PROCESS SCHEDULED EVENTS
       ======================================================== */

    console.log(
      "[ENGINE] 4/5 Processing scheduled events...",
    );


    for (
      const run of scheduledRuns
    ) {

      console.log(
        `[ENGINE] Event: ${run.triggerTypes.join(", ")}`
        + ` | Schedule: ${run.scheduleLabel}`
        + ` | Customers: ${run.matches.length}`,
      );


      const customers =
        run.matches;


      /* ------------------------------------------------------
         NO CUSTOMERS
         ------------------------------------------------------ */

      if (
        customers.length === 0
      ) {

        console.log(
          "[ENGINE] No customers matched this event.",
        );

        continue;
      }


      customersProcessed +=
        customers.length;


      /* ------------------------------------------------------
         CONDITION → TEMPLATE → SEND → LOG
         ------------------------------------------------------ */

      const results =
        await executeCampaignRun(
          customers,
        );


      allResults.push(
        ...results,
      );
    }
  }


  /* ==========================================================
     5. FINAL SUMMARY
     ========================================================== */

  const sent =
    allResults.filter(
      result =>
        result.outcome ===
        "SENT",
    ).length;


  const skipped =
    allResults.filter(
      result =>
        result.outcome ===
        "SKIPPED",
    ).length;


  const failed =
    allResults.filter(
      result =>
        result.outcome ===
        "FAILED",
    ).length;


  /* ==========================================================
     LOG FINAL RESULT
     ========================================================== */

  console.log("");

  console.log(
    "================================================",
  );

  console.log(
    "[ENGINE] AUTOMATION RUN COMPLETE",
  );

  console.log(
    `[ENGINE] Restaurants: ${restaurantsProcessed}`,
  );

  console.log(
    `[ENGINE] Customers: ${customersProcessed}`,
  );

  console.log(
    `[ENGINE] SENT: ${sent}`,
  );

  console.log(
    `[ENGINE] SKIPPED: ${skipped}`,
  );

  console.log(
    `[ENGINE] FAILED: ${failed}`,
  );

  console.log(
    "================================================",
  );


  /* ==========================================================
     RETURN RESULT
     ========================================================== */

  return {

    success:
      failed === 0,

    restaurantsProcessed,

    customersProcessed,

    sent,

    skipped,

    failed,

    results:
      allResults,
  };
}