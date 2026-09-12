// src/lib/campaigns_automation/trigger.ts

import { createAdminClient } from "@/lib/supabase/admin";

import {
  getDefaultTemplates,
} from "./config";


/* ============================================================
   TRIGGER TYPES
   ============================================================ */

/**
 * These are all automation types supported by the system.
 *
 * The actual enabled/disabled state for each restaurant
 * is stored in the automation_triggers table.
 */
export type TriggerType =
  | "new_customer"
  | "inactive_customer"
  | "repeat_purchase"
  | "birthday"
  | "anniversary"
  | "holiday"
  | "vip_customer";


/* ============================================================
   ELIGIBLE CUSTOMER
   ============================================================ */

/**
 * This is the object that leaves trigger.ts and enters
 * the next part of the automation pipeline.
 *
 * It contains everything the engine needs to know about
 * a customer who matched an automation event.
 */
export interface EligibleCustomer {

  /**
   * Which automation matched this customer.
   */
  triggerType: TriggerType;

  /**
   * Customer's actual ID.
   */
  customerId: string;

  /**
   * Restaurant this customer belongs to.
   */
  restaurantId: string;

  /**
   * Customer name.
   */
  name: string;

  /**
   * Customer email.
   */
  email: string | null;

  /**
   * Customer phone number.
   */
  phone: string | null;

  /**
   * Actual birthday/anniversary date.
   */
  eventDate: string;

  /**
   * Channels configured by the restaurant.
   *
   * Example:
   *
   * ["whatsapp"]
   */
  channels: string[];

  /**
   * ID of the template that should be used.
   *
   * IMPORTANT:
   *
   * This comes from config.ts.
   * It does NOT come from the database.
   */
  templateId: string;
}


/* ============================================================
   AUTOMATIC CAMPAIGN SETTINGS
   ============================================================ */

/**
 * Represents one row from:
 *
 * automatic_campaign_settings
 *
 * IMPORTANT:
 *
 * The database column is:
 *
 * days_before_trigger
 *
 * NOT:
 *
 * days_before
 */
interface AutomaticCampaignSettingsRow {

  /**
   * Primary key of automatic_campaign_settings.
   */
  id: string;

  /**
   * Restaurant associated with this automation.
   */
  restaurant_id: string;

  /**
   * Master automation switch.
   */
  enabled: boolean;

  /**
   * Channels selected by the restaurant.
   */
  channels: string[] | null;

  /**
   * Number of days before the event.
   *
   * 0 = today
   * 1 = tomorrow
   * 2 = two days from now
   */
  days_before_trigger: number | null;
}


/* ============================================================
   AUTOMATION TRIGGERS
   ============================================================ */

/**
 * Represents the boolean trigger configuration
 * stored in automation_triggers.
 *
 * Each restaurant has one trigger configuration row.
 */
interface AutomationTriggersRow {

  /**
   * Links this row to automatic_campaign_settings.id.
   */
  settings_id: string;

  /**
   * New customer automation.
   */
  new_customer: boolean | null;

  /**
   * Inactive customer automation.
   */
  inactive_customer: boolean | null;

  /**
   * Repeat purchase automation.
   */
  repeat_purchase: boolean | null;

  /**
   * Birthday automation.
   */
  birthday: boolean | null;

  /**
   * Anniversary automation.
   */
  anniversary: boolean | null;

  /**
   * Holiday automation.
   */
  holiday: boolean | null;

  /**
   * VIP customer automation.
   */
  vip_customer: boolean | null;
}


/* ============================================================
   CUSTOMER DETAILS
   ============================================================ */

/**
 * Represents the customer data needed for
 * birthday and anniversary matching.
 */
interface CustomerDetailRow {

  /**
   * Customer detail row ID.
   */
  id: string;

  /**
   * Actual customer ID.
   */
  customer_id: string;

  /**
   * Customer name.
   */
  name: string;

  /**
   * Customer phone.
   */
  phone: string | null;

  /**
   * Customer email.
   */
  email: string | null;

  /**
   * Restaurant the customer belongs to.
   */
  restaurant_id: string | null;

  /**
   * Customer birthday.
   */
  Date_of_birth: string | null;

  /**
   * Customer anniversary.
   */
  anniversary_date: string | null;
}


/* ============================================================
   DATE COLUMN MAP
   ============================================================ */

/**
 * Maps an automation trigger to the corresponding
 * customer_details date column.
 */
const DATE_COLUMN_BY_TRIGGER: Record<
  "birthday" | "anniversary",
  "Date_of_birth" | "anniversary_date"
> = {

  /**
   * Birthday → Date_of_birth
   */
  birthday: "Date_of_birth",

  /**
   * Anniversary → anniversary_date
   */
  anniversary: "anniversary_date",
};


/* ============================================================
   TARGET DATE
   ============================================================ */

/**
 * Calculates the date that should contain the event.
 *
 * Example:
 *
 * Today = September 3
 *
 * days_before_trigger = 0
 * → September 3
 *
 * days_before_trigger = 1
 * → September 4
 *
 * days_before_trigger = 2
 * → September 5
 *
 * We compare only MM-DD because birthdays and anniversaries
 * repeat every year.
 */
function targetMonthDay(
  offsetDays: number,
  timeZone = "Asia/Kolkata",
): string {

  const now = new Date();

  const target = new Date(
    now.getTime() +
      offsetDays * 24 * 60 * 60 * 1000,
  );

  const parts = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone,
      month: "2-digit",
      day: "2-digit",
    },
  ).formatToParts(target);

  const month =
    parts.find(
      (part) => part.type === "month",
    )?.value;

  const day =
    parts.find(
      (part) => part.type === "day",
    )?.value;

  return `${month}-${day}`;
}


/* ============================================================
   TRIGGER CHECK
   ============================================================ */

/**
 * Checks whether a particular trigger is enabled
 * for a restaurant.
 *
 * Example:
 *
 * isTriggerEnabled(triggers, "birthday")
 *
 * returns:
 *
 * true
 *
 * when triggers.birthday === true.
 */
function isTriggerEnabled(
  triggers: AutomationTriggersRow,
  triggerType: TriggerType,
): boolean {

  /**
   * Check the corresponding database boolean.
   */
  switch (triggerType) {

    case "new_customer":
      return triggers.new_customer === true;

    case "inactive_customer":
      return triggers.inactive_customer === true;

    case "repeat_purchase":
      return triggers.repeat_purchase === true;

    case "birthday":
      return triggers.birthday === true;

    case "anniversary":
      return triggers.anniversary === true;

    case "holiday":
      return triggers.holiday === true;

    case "vip_customer":
      return triggers.vip_customer === true;

    /**
     * Safety fallback.
     */
    default:
      return false;
  }
}


/* ============================================================
   GET LOCAL TEMPLATE
   ============================================================ */

/**
 * Gets the default template from config.ts.
 *
 * IMPORTANT:
 *
 * Templates are NOT stored in Supabase right now.
 *
 * They live in:
 *
 * src/lib/campaigns_automation/config.ts
 *
 * Therefore trigger.ts should NOT query template_map.
 */
function getTemplateForTrigger(
  triggerType: TriggerType,
): string | null {

  /**
   * Load all templates defined in config.ts.
   */
  const templates =
    getDefaultTemplates();

  /**
   * Find the template whose automationCategory
   * matches the trigger.
   *
   * Example:
   *
   * birthday
   * →
   * template with:
   *
   * automationCategory: "birthday"
   */
  const template =
    templates.find(
      (item) =>
        item.automationCategory ===
        triggerType,
    );

  /**
   * No template exists for this automation.
   */
  if (!template) {

    console.warn(
      `[trigger.ts] No local template configured for ${triggerType}.`,
    );

    return null;
  }

  /**
   * Return the local template ID.
   */
  return template.id;
}


/* ============================================================
   FIND DATE-BASED CUSTOMERS
   ============================================================ */

/**
 * Finds customers whose birthday or anniversary
 * falls on the target date.
 *
 * This function answers:
 *
 * "WHO has the event?"
 *
 * It does NOT:
 *
 * - send messages
 * - check duplicate logs
 * - call actions.ts
 * - call engine.ts
 */
async function findDateBasedCustomers(
  restaurantId: string,

  triggerType:
    | "birthday"
    | "anniversary",

  daysBefore: number,
): Promise<CustomerDetailRow[]> {

  /**
   * Create the Supabase server client.
   */
  const supabase =
    await createAdminClient();

  /**
   * Determine which customer_details column
   * should be checked.
   */
  const dateColumn =
    DATE_COLUMN_BY_TRIGGER[
      triggerType
    ];

  /**
   * Load customers belonging ONLY to this restaurant.
   */
  const {
    data,
    error,
  } = await supabase

    .from("customer_details")

    .select(
      `
        id,
        customer_id,
        name,
        phone,
        email,
        restaurant_id,
        "Date_of_birth",
        anniversary_date
      `,
    )

    /**
     * CRITICAL:
     *
     * Only customers belonging to the restaurant
     * currently being processed are loaded.
     */
    .eq(
      "restaurant_id",
      restaurantId,
    )

    /**
     * Ignore customers who do not have
     * the required date.
     */
    .not(
      dateColumn,
      "is",
      null,
    );

  /**
   * Stop if Supabase returned an error.
   */
  if (error) {
    throw error;
  }

  /**
   * Calculate the date we are looking for.
   */
  const targetMMDD =
    targetMonthDay(
      daysBefore,
    );

  /**
   * Filter the customers by month/day.
   *
   * We ignore the birth year because birthdays
   * happen every year.
   */
  return (
    (data || []) as CustomerDetailRow[]
  ).filter(
    (customer) => {

      /**
       * Get the customer's birthday or anniversary.
       */
      const eventDate =
        customer[dateColumn];

      /**
       * Safety check.
       */
      if (!eventDate) {
        return false;
      }

      /**
       * Compare:
       *
       * customer MM-DD
       *
       * with:
       *
       * target MM-DD
       */
      return (
        String(eventDate)
          .slice(5, 10) ===
        targetMMDD
      );
    },
  );
}


/* ============================================================
   FIND ELIGIBLE CUSTOMERS
   ============================================================ */

/**
 * Main trigger function.
 *
 * This function answers:
 *
 * "Which customers should enter the automation pipeline?"
 *
 * Flow:
 *
 * engine.ts
 *     ↓
 * trigger.ts
 *     ↓
 * load automation settings
 *     ↓
 * load trigger booleans
 *     ↓
 * find birthday/anniversary customers
 *     ↓
 * load local template from config.ts
 *     ↓
 * return EligibleCustomer[]
 */
export async function findEligibleCustomers(
  restaurantId?: string,
): Promise<EligibleCustomer[]> {

  /**
   * Create Supabase server client.
   */
  const supabase =
    await createAdminClient();

  /**
   * Final list of customers that matched.
   */
  const results:
    EligibleCustomer[] = [];


  /* ==========================================================
     1. LOAD ENABLED AUTOMATION SETTINGS
     ========================================================== */

  /**
   * Load automation settings.
   *
   * IMPORTANT:
   *
   * We use:
   *
   * days_before_trigger
   *
   * because that is the actual DB column.
   */
  let settingsQuery =
    supabase

      .from(
        "automatic_campaign_settings",
      )

      .select(
        `
          id,
          restaurant_id,
          enabled,
          channels,
          days_before_trigger
        `,
      )

      /**
       * Only enabled restaurants.
       */
      .eq(
        "enabled",
        true,
      );


  /* ==========================================================
     2. OPTIONAL RESTAURANT FILTER
     ========================================================== */

  /**
   * When engine.ts passes a restaurant ID,
   * only process that restaurant.
   *
   * When no restaurant ID is passed,
   * process all enabled restaurants.
   */
  if (restaurantId) {

    settingsQuery =
      settingsQuery.eq(
        "restaurant_id",
        restaurantId,
      );
  }


  /* ==========================================================
     3. EXECUTE SETTINGS QUERY
     ========================================================== */

  const {
    data: settingsRows,
    error: settingsError,
  } = await settingsQuery;


  /**
   * Stop if the database query failed.
   */
  if (settingsError) {
    throw settingsError;
  }


  /* ==========================================================
     4. NOTHING ENABLED
     ========================================================== */

  /**
   * No enabled automation settings means
   * there is nothing for trigger.ts to process.
   */
  if (
    !settingsRows ||
    settingsRows.length === 0
  ) {

    console.log(
      "[trigger.ts] No enabled automation settings found.",
    );

    return [];
  }


  console.log(
    `[trigger.ts] Found ${settingsRows.length} enabled automation setting(s).`,
  );


  /* ==========================================================
     5. PROCESS EACH RESTAURANT
     ========================================================== */

  /**
   * IMPORTANT:
   *
   * This loop processes each restaurant independently.
   *
   * Restaurant 1
   *     ↓
   * triggers
   *     ↓
   * customers
   *
   * Then:
   *
   * Restaurant 2
   *     ↓
   * triggers
   *     ↓
   * customers
   */
  for (
    const settings of
      settingsRows as
        AutomaticCampaignSettingsRow[]
  ) {

    /**
     * Current restaurant ID.
     */
    const currentRestaurantId =
      settings.restaurant_id;


    console.log(
      `[trigger.ts] Checking restaurant ${currentRestaurantId}`,
    );


    /* ========================================================
       6. LOAD TRIGGER CONFIGURATION
       ======================================================== */

    /**
     * Load the boolean trigger configuration
     * belonging to this automation settings row.
     */
    const {
      data: triggerSettings,
      error: triggerError,
    } = await supabase

      .from(
        "automation_triggers",
      )

      .select(
        `
          settings_id,
          new_customer,
          inactive_customer,
          repeat_purchase,
          birthday,
          anniversary,
          holiday,
          vip_customer
        `,
      )

      .eq(
        "settings_id",
        settings.id,
      )

      .maybeSingle();


    /**
     * If trigger configuration cannot be loaded,
     * skip this restaurant rather than crashing
     * the entire automation engine.
     */
    if (triggerError) {

      console.error(
        `[trigger.ts] Failed to load triggers for restaurant ${currentRestaurantId}:`,
        triggerError,
      );

      continue;
    }


    /* ========================================================
       7. NO TRIGGER CONFIGURATION
       ======================================================== */

    /**
     * A restaurant may have automatic_campaign_settings
     * but no corresponding automation_triggers row.
     */
    if (!triggerSettings) {

      console.log(
        `[trigger.ts] No trigger configuration for restaurant ${currentRestaurantId}`,
      );

      continue;
    }


    /**
     * Cast the returned row to our interface.
     */
    const triggers =
      triggerSettings as
        AutomationTriggersRow;


    /* ========================================================
       8. DETERMINE ENABLED DATE TRIGGERS
       ======================================================== */

    /**
     * Scheduler/trigger currently handles:
     *
     * - birthday
     * - anniversary
     *
     * Other trigger types can be implemented later.
     */
    const dateBasedTriggers:
      Array<
        "birthday" | "anniversary"
      > = [];


    /**
     * Check birthday.
     */
    if (
      isTriggerEnabled(
        triggers,
        "birthday",
      )
    ) {

      dateBasedTriggers.push(
        "birthday",
      );
    }


    /**
     * Check anniversary.
     */
    if (
      isTriggerEnabled(
        triggers,
        "anniversary",
      )
    ) {

      dateBasedTriggers.push(
        "anniversary",
      );
    }


    console.log(
      `[trigger.ts] Enabled date triggers: ${
        dateBasedTriggers.length > 0
          ? dateBasedTriggers.join(", ")
          : "none"
      }`,
    );


    /* ========================================================
       9. NO DATE TRIGGERS
       ======================================================== */

    /**
     * If birthday and anniversary are both disabled,
     * there is currently nothing for this trigger pipeline
     * to process.
     */
    if (
      dateBasedTriggers.length === 0
    ) {

      console.log(
        `[trigger.ts] No birthday/anniversary triggers enabled for restaurant ${currentRestaurantId}`,
      );

      continue;
    }


    /* ========================================================
       10. GET SCHEDULE OFFSET
       ======================================================== */

    /**
     * Read the actual database column:
     *
     * days_before_trigger
     *
     * Default to 0 if somehow null.
     */
    const daysBefore =
      settings.days_before_trigger ?? 0;


    /**
     * Safety validation.
     *
     * Currently we support:
     *
     * 0 = today
     * 1 = one day before
     * 2 = two days before
     */
    if (
      daysBefore !== 0 &&
      daysBefore !== 1 &&
      daysBefore !== 2
    ) {

      console.warn(
        `[trigger.ts] Invalid days_before_trigger=${daysBefore} for restaurant ${currentRestaurantId}. Skipping.`,
      );

      continue;
    }


    console.log(
      `[trigger.ts] Checking events ${daysBefore} day(s) before for restaurant ${currentRestaurantId}`,
    );


    /* ========================================================
       11. PROCESS EACH DATE TRIGGER
       ======================================================== */

    /**
     * Birthday and anniversary are processed separately.
     */
    for (
      const triggerType of
        dateBasedTriggers
    ) {


      /* ======================================================
         12. GET TEMPLATE FROM config.ts
         ====================================================== */

      /**
       * Templates are local right now.
       *
       * Therefore we DO NOT query:
       *
       * automatic_campaign_settings.template_map
       *
       * Instead:
       *
       * triggerType
       *     ↓
       * config.ts
       *     ↓
       * matching AutomationTemplate
       */
      const templateId =
        getTemplateForTrigger(
          triggerType,
        );


      /**
       * If there is no local template for this
       * automation type, skip it.
       */
      if (!templateId) {

        console.warn(
          `[trigger.ts] No local template mapped for ${triggerType} in restaurant ${currentRestaurantId}`,
        );

        continue;
      }


      console.log(
        `[trigger.ts] Using local template ${templateId} for ${triggerType}`,
      );


      /* ======================================================
         13. FIND MATCHING CUSTOMERS
         ====================================================== */

      /**
       * Find customers whose birthday/anniversary
       * matches the configured schedule.
       */
      const customers =
        await findDateBasedCustomers(
          currentRestaurantId,

          triggerType,

          daysBefore,
        );


      console.log(
        `[trigger.ts] ${customers.length} ${triggerType} customer(s) found for restaurant ${currentRestaurantId}`,
      );


      /* ======================================================
         14. CONVERT CUSTOMERS INTO PIPELINE RESULTS
         ====================================================== */

      /**
       * Determine which date column was used.
       */
      const dateColumn =
        DATE_COLUMN_BY_TRIGGER[
          triggerType
        ];


      /**
       * Process every matching customer.
       */
      for (
        const customer of
          customers
      ) {


        /* ----------------------------------------------------
           CUSTOMER MUST BELONG TO RESTAURANT
           ---------------------------------------------------- */

        /**
         * Extra safety check.
         *
         * Never allow a customer from another restaurant
         * into this restaurant's automation pipeline.
         */
        if (
          customer.restaurant_id !==
          currentRestaurantId
        ) {

          console.warn(
            `[trigger.ts] Skipping customer ${customer.customer_id} because restaurant_id does not match.`,
          );

          continue;
        }


        /* ----------------------------------------------------
           CUSTOMER MUST HAVE ID
           ---------------------------------------------------- */

        /**
         * Without a customer ID we cannot safely
         * continue through the pipeline.
         */
        if (
          !customer.customer_id
        ) {

          continue;
        }


        /* ----------------------------------------------------
           EVENT DATE MUST EXIST
           ---------------------------------------------------- */

        /**
         * Get the actual birthday/anniversary date.
         */
        const eventDate =
          customer[
            dateColumn
          ];


        /**
         * Safety check.
         */
        if (!eventDate) {
          continue;
        }


        /* ----------------------------------------------------
           ADD CUSTOMER TO RESULTS
           ---------------------------------------------------- */

        /**
         * This is what eventually gets returned
         * to scheduler.ts / engine.ts.
         */
        results.push({

          /**
           * birthday or anniversary.
           */
          triggerType,

          /**
           * Actual customer ID.
           */
          
  customerId:
    customer.id,

          /**
           * Restaurant being processed.
           */
          restaurantId:
            currentRestaurantId,

          /**
           * Customer name.
           */
          name:
            customer.name,

          /**
           * Customer email.
           */
          email:
            customer.email,

          /**
           * Customer phone.
           */
          phone:
            customer.phone,

          /**
           * Actual event date.
           */
          eventDate:
            String(eventDate),

          /**
           * Channels configured for this restaurant.
           */
          channels:
            settings.channels || [],

          /**
           * Local template ID from config.ts.
           */
          templateId,
        });
      }
    }
  }


  /* ==========================================================
     15. FINAL RESULT
     ========================================================== */

  /**
   * At this point all enabled restaurants have been processed.
   */
  console.log(
    `[trigger.ts] Found ${results.length} total automation recipient(s).`,
  );


  /* ==========================================================
     16. RETURN RESULTS TO SCHEDULER
     ========================================================== */

  /**
   * trigger.ts returns data to scheduler.ts.
   *
   * It NEVER calls scheduler.ts or engine.ts.
   *
   * Correct flow:
   *
   * engine
   *   ↓
   * scheduler
   *   ↓
   * trigger
   *
   * NOT:
   *
   * trigger
   *   ↓
   * scheduler
   *   ↓
   * engine
   *
   * This prevents circular execution.
   */
  return results;
}