// src/lib/campaigns_automation/scheduler.ts

import { createAdminClient } from "@/lib/supabase/admin";

import {
  findEligibleCustomers,
  type EligibleCustomer,
  type TriggerType,
} from "./trigger";

/* ============================================================
   TYPES
   ============================================================ */

/**
 * The three scheduling options currently supported by the UI.
 *
 * 0 = Today
 * 1 = 1 Day Before
 * 2 = 2 Days Before
 */
export type ScheduleLabel =
  | "today"
  | "1_day_before"
  | "2_days_before";

/**
 * Shape of the row we actually have in:
 *
 * automatic_campaign_settings
 *
 * IMPORTANT:
 * The database column is `days_before_trigger`.
 * There is NO `days_before` column.
 */
interface AutomaticCampaignSettingsRow {
  id: string;
  restaurant_id: string;
  enabled: boolean;
  channels: string[] | null;
  days_before_trigger: number | null;
  template_map: Record<string, string> | null;
}

/**
 * What the scheduler gives to the engine.
 */
export interface ScheduledRun {
  restaurantId: string;

  scheduleLabel: ScheduleLabel;

  daysBefore: number;

  triggerTypes: TriggerType[];

  matches: EligibleCustomer[];
}

/* ============================================================
   CONSTANTS
   ============================================================ */

/**
 * Convert the numeric database value into a readable label.
 */
const SCHEDULE_LABEL_BY_OFFSET: Record<
  number,
  ScheduleLabel
> = {
  0: "today",
  1: "1_day_before",
  2: "2_days_before",
};

/**
 * Date-based triggers are the triggers that require
 * the scheduler to look at a customer's date.
 *
 * Birthday:
 * - customer birthday
 *
 * Anniversary:
 * - customer anniversary
 *
 * Holiday is intentionally NOT included here yet because
 * your current trigger.ts handles birthday/anniversary
 * date matching.
 */
const DATE_BASED_TRIGGERS: TriggerType[] = [
  "birthday",
  "anniversary",
];

/* ============================================================
   RESOLVE SCHEDULE LABEL
   ============================================================ */

/**
 * Convert:
 *
 * 0 → today
 * 1 → 1_day_before
 * 2 → 2_days_before
 *
 * Invalid values are rejected elsewhere.
 */
function resolveScheduleLabel(
  daysBefore: number,
): ScheduleLabel {
  return (
    SCHEDULE_LABEL_BY_OFFSET[daysBefore] ??
    "today"
  );
}

/* ============================================================
   VALIDATE SCHEDULE OFFSET
   ============================================================ */

/**
 * Make sure the database contains a value that
 * the current UI actually supports.
 */
function isValidScheduleOffset(
  daysBefore: number,
): boolean {
  return (
    daysBefore === 0 ||
    daysBefore === 1 ||
    daysBefore === 2
  );
}

/* ============================================================
   GET AUTOMATION SETTINGS
   ============================================================ */

/**
 * Load all enabled restaurant automation configurations.
 *
 * IMPORTANT:
 *
 * We use the ADMIN client here because this function is
 * executed by the automation engine / cron.
 *
 * The query is against:
 *
 * automatic_campaign_settings
 *
 * and NOT profiles.
 *
 * Every enabled row represents one restaurant's
 * automation configuration.
 */
async function getAutomationSettings(
  restaurantId?: string,
): Promise<AutomaticCampaignSettingsRow[]> {
  const supabase = await createAdminClient();

  /**
   * Query only the columns that actually exist
   * in automatic_campaign_settings.
   *
   * DO NOT change `days_before_trigger` to `days_before`.
   */
  let query = supabase
    .from("automatic_campaign_settings")
    .select(
      `
        id,
        restaurant_id,
        enabled,
        channels,
        days_before_trigger,
        template_map
      `,
    )
    .eq("enabled", true);

  /**
   * If the engine was asked to process one restaurant,
   * restrict the query to that restaurant.
   *
   * Otherwise it processes ALL enabled restaurants.
   */
  if (restaurantId) {
    query = query.eq(
      "restaurant_id",
      restaurantId,
    );
  }

  const {
    data,
    error,
  } = await query;

  if (error) {
    console.error(
      "[scheduler.ts] Failed to load automation settings:",
      error,
    );

    throw error;
  }

  console.log(
    `[scheduler.ts] Found ${(data ?? []).length} enabled automation(s).`,
  );

  return (
    (data ?? []) as AutomaticCampaignSettingsRow[]
  );
}

/* ============================================================
   GET TRIGGERS
   ============================================================ */

/**
 * Get the date-based triggers that the scheduler
 * currently knows how to process.
 *
 * IMPORTANT:
 *
 * We are NOT reading trigger_types from
 * automatic_campaign_settings anymore.
 *
 * Your current database design removed that column.
 *
 * trigger.ts is responsible for determining the
 * actual customer matches.
 */
function getDateBasedTriggers(
  matches: EligibleCustomer[],
): TriggerType[] {
  const triggerSet = new Set<TriggerType>();

  /**
   * Look at the actual customers returned by trigger.ts
   * and determine which date trigger produced the match.
   */
  for (const customer of matches) {
    if (
      customer.triggerType === "birthday" ||
      customer.triggerType === "anniversary"
    ) {
      triggerSet.add(
        customer.triggerType,
      );
    }
  }

  return Array.from(triggerSet);
}

/* ============================================================
   BUILD ONE SCHEDULED RUN
   ============================================================ */

/**
 * Process one restaurant's automation configuration.
 *
 * This function:
 *
 * 1. Reads the restaurant configuration.
 * 2. Reads days_before_trigger.
 * 3. Asks trigger.ts for matching customers.
 * 4. Creates a ScheduledRun.
 *
 * It DOES NOT send anything.
 */
async function buildScheduledRun(
  settings: AutomaticCampaignSettingsRow,
): Promise<ScheduledRun | null> {
  const restaurantId =
    settings.restaurant_id;

  /**
   * IMPORTANT:
   *
   * The database column is:
   *
   * days_before_trigger
   *
   * We convert it internally to the shorter variable
   * name `daysBefore`.
   */
  const daysBefore =
    settings.days_before_trigger ?? 0;

  console.log("");
  console.log(
    `[scheduler.ts] Restaurant: ${restaurantId}`,
  );

  console.log(
    `[scheduler.ts] Days before trigger: ${daysBefore}`,
  );

  /* ----------------------------------------------------------
     VALIDATE DAYS BEFORE
     ---------------------------------------------------------- */

  if (
    !isValidScheduleOffset(
      daysBefore,
    )
  ) {
    console.log(
      `[scheduler.ts] Invalid days_before_trigger=${daysBefore}. Skipping restaurant.`,
    );

    return null;
  }

  /* ----------------------------------------------------------
     RESOLVE SCHEDULE
     ---------------------------------------------------------- */

  const scheduleLabel =
    resolveScheduleLabel(
      daysBefore,
    );

  console.log(
    `[scheduler.ts] Schedule: ${scheduleLabel}`,
  );

  /* ----------------------------------------------------------
     FIND ELIGIBLE CUSTOMERS
     ---------------------------------------------------------- */

  /**
   * trigger.ts is the source of truth for customer
   * trigger matching.
   *
   * It should determine:
   *
   * - birthday matches
   * - anniversary matches
   * - templates
   * - channels
   * - customer contact information
   * - etc.
   *
   * scheduler.ts should NOT duplicate that logic.
   */
  const matches =
    await findEligibleCustomers(
      restaurantId,
    );

  /* ----------------------------------------------------------
     NO MATCHES
     ---------------------------------------------------------- */

  if (matches.length === 0) {
    console.log(
      `[scheduler.ts] No eligible customers for restaurant ${restaurantId}.`,
    );

    return null;
  }

  /* ----------------------------------------------------------
     DETERMINE TRIGGERS FROM MATCHES
     ---------------------------------------------------------- */

  const triggerTypes =
    getDateBasedTriggers(
      matches,
    );

  /**
   * If trigger.ts returned customers but none of them
   * came from a supported date trigger, do not create
   * a scheduled date-based run.
   */
  if (triggerTypes.length === 0) {
    console.log(
      `[scheduler.ts] Matches found, but no supported date-based trigger was identified.`,
    );

    return null;
  }

  console.log(
    `[scheduler.ts] Date triggers: ${triggerTypes.join(", ")}`,
  );

  console.log(
    `[scheduler.ts] Matched customers: ${matches.length}`,
  );

  /* ----------------------------------------------------------
     CREATE SCHEDULED RUN
     ---------------------------------------------------------- */

  return {
    restaurantId,

    scheduleLabel,

    daysBefore,

    triggerTypes,

    matches,
  };
}

/* ============================================================
   MAIN SCHEDULER
   ============================================================ */

/**
 * MAIN ENTRY POINT
 *
 * The automation engine calls:
 *
 * runScheduler()
 *
 * The scheduler then:
 *
 * 1. Gets all enabled restaurants.
 * 2. Processes restaurant #1.
 * 3. Processes restaurant #2.
 * 4. Processes restaurant #3.
 * 5. Continues until every enabled restaurant is checked.
 *
 * It returns all scheduled automation runs.
 *
 * IMPORTANT:
 *
 * scheduler.ts does NOT send messages.
 */
export async function runScheduler(
  restaurantId?: string,
): Promise<ScheduledRun[]> {
  console.log(
    "[scheduler.ts] Starting scheduler...",
  );

  /* ----------------------------------------------------------
     LOAD ENABLED AUTOMATIONS
     ---------------------------------------------------------- */

  const settingsRows =
    await getAutomationSettings(
      restaurantId,
    );

  /* ----------------------------------------------------------
     NO ENABLED AUTOMATIONS
     ---------------------------------------------------------- */

  if (settingsRows.length === 0) {
    console.log(
      "[scheduler.ts] No enabled automation settings found.",
    );

    return [];
  }

  /* ----------------------------------------------------------
     PROCESS EVERY RESTAURANT
     ---------------------------------------------------------- */

  const scheduledRuns: ScheduledRun[] = [];

  for (
    const settings of settingsRows
  ) {
    try {
      const scheduledRun =
        await buildScheduledRun(
          settings,
        );

      /**
       * No scheduled run means this restaurant
       * simply has nothing to send right now.
       *
       * IMPORTANT:
       *
       * We CONTINUE to the next restaurant.
       *
       * One restaurant failing or having no customers
       * should NOT stop the entire automation engine.
       */
      if (!scheduledRun) {
        continue;
      }

      scheduledRuns.push(
        scheduledRun,
      );
    } catch (error) {
      /**
       * IMPORTANT:
       *
       * Catch errors PER RESTAURANT.
       *
       * This means:
       *
       * Restaurant A → error
       * Restaurant B → still gets processed
       * Restaurant C → still gets processed
       */
      console.error(
        `[scheduler.ts] Failed processing restaurant ${settings.restaurant_id}:`,
        error,
      );

      continue;
    }
  }

  /* ----------------------------------------------------------
     FINAL SUMMARY
     ---------------------------------------------------------- */

  console.log(
    `[scheduler.ts] Scheduler finished. ${scheduledRuns.length} scheduled run(s) found.`,
  );

  return scheduledRuns;
}

/* ============================================================
   GET SCHEDULED CUSTOMERS
   ============================================================ */

/**
 * Convenience helper.
 *
 * Returns only the customers that are currently
 * scheduled for automation.
 *
 * It does NOT send anything.
 */
export async function getScheduledCustomers(
  restaurantId?: string,
): Promise<EligibleCustomer[]> {
  const scheduledRuns =
    await runScheduler(
      restaurantId,
    );

  return scheduledRuns.flatMap(
    (run) => run.matches,
  );
}

/* ============================================================
   CHECK IF AUTOMATION IS DUE
   ============================================================ */

/**
 * Convenience helper for CRON/testing.
 *
 * Returns:
 *
 * true
 *     At least one customer is due.
 *
 * false
 *     Nothing is currently due.
 */
export async function hasScheduledAutomations(
  restaurantId?: string,
): Promise<boolean> {
  const scheduledRuns =
    await runScheduler(
      restaurantId,
    );

  return scheduledRuns.length > 0;
}