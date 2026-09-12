// src/lib/campaigns_automation/config.ts

/* ============================================================
   AUTOMATION CATEGORY
   ============================================================ */

/**
 * These categories MUST match the trigger types used
 * by the automation engine.
 *
 * IMPORTANT:
 * "holiday" is used here instead of "holiday_season"
 * because trigger.ts uses "holiday".
 */
export type AutomationCategory =
    | "new_customer"
    | "inactive_customer"
    | "repeat_purchase"
    | "birthday"
    | "anniversary"
    | "holiday"
    | "vip_customer";


/* ============================================================
   TEMPLATE TIMING
   ============================================================ */

/**
 * Determines when the template is intended to be used.
 *
 * default:
 *   Event day / normal campaign
 *
 * one_day_before:
 *   One day before the event
 *
 * two_days_before:
 *   Two days before the event
 */
export type TemplateTiming =
    | "default"
    | "one_day_before"
    | "two_days_before";


/* ============================================================
   DISCOUNT CATEGORY
   ============================================================ */

export type DiscountCategory =
    | "No Discount"
    | "Free Item"
    | "₹ discount"
    | "% discount";


/* ============================================================
   AUTOMATION TEMPLATE
   ============================================================ */

/**
 * Defines one local automation template.
 *
 * IMPORTANT:
 *
 * These templates are configuration/code.
 *
 * They do NOT need to exist in Supabase.
 *
 * The database only controls:
 * - whether automation is enabled
 * - which triggers are enabled
 * - channels
 * - scheduling settings
 *
 * config.ts controls:
 * - template content
 * - template identity
 * - template timing
 * - offer information
 */
export interface AutomationTemplate {
    id: string;

    automationCategory:
        AutomationCategory;

    title: string;

    discount: string;

    category:
        DiscountCategory;

    occasion: string;

    imageUrl: string;

    summary: string;

    audience: string;

    channel: string;

    timing:
        TemplateTiming;
}


/* ============================================================
   DEFAULT TEMPLATES
   ============================================================ */

/**
 * Templates used when the automation runs on the
 * default/event-day timing.
 */
export function getDefaultTemplates():
    AutomationTemplate[] {

    return [

        /* ------------------------------------------------------
           NEW CUSTOMER
           ------------------------------------------------------ */

        {
            id:
                "new_customer_default",

            automationCategory:
                "new_customer",

            title:
                "Welcome! Enjoy 10% Off Your First Visit",

            discount:
                "10% Off",

            category:
                "% discount",

            occasion:
                "New Customer",

            imageUrl:
                "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80",

            summary:
                "Welcome new customers with a simple first-visit discount and encourage them to return.",

            audience:
                "New customers",

            channel:
                "WhatsApp",

            timing:
                "default",
        },


        /* ------------------------------------------------------
           INACTIVE CUSTOMER
           ------------------------------------------------------ */

        {
            id:
                "inactive_customer_default",

            automationCategory:
                "inactive_customer",

            title:
                "We Miss You! Come Back & Enjoy 15% Off",

            discount:
                "15% Off",

            category:
                "% discount",

            occasion:
                "Inactive Customer",

            imageUrl:
                "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=600&q=80",

            summary:
                "Re-engage customers who have not visited recently with a welcoming return offer.",

            audience:
                "Inactive customers",

            channel:
                "WhatsApp",

            timing:
                "default",
        },


        /* ------------------------------------------------------
           REPEAT PURCHASE
           ------------------------------------------------------ */

        {
            id:
                "repeat_purchase_default",

            automationCategory:
                "repeat_purchase",

            title:
                "Thanks for Coming Back! Enjoy a FREE Dessert",

            discount:
                "Free Dessert",

            category:
                "Free Item",

            occasion:
                "Repeat Purchase",

            imageUrl:
                "https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=600&q=80",

            summary:
                "Reward returning customers with a complimentary dessert for their continued support.",

            audience:
                "Repeat customers",

            channel:
                "WhatsApp",

            timing:
                "default",
        },


        /* ------------------------------------------------------
           BIRTHDAY
           ------------------------------------------------------ */

        {
            id:
                "birthday_default",

            automationCategory:
                "birthday",

            title:
                "Happy Birthday! A FREE Cake Is Waiting for You",

            discount:
                "Free Cake",

            category:
                "Free Item",

            occasion:
                "Birthday",

            imageUrl:
                "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80",

            summary:
                "Celebrate the customer's birthday with a complimentary birthday treat.",

            audience:
                "Birthday customers",

            channel:
                "WhatsApp",

            timing:
                "default",
        },


        /* ------------------------------------------------------
           ANNIVERSARY
           ------------------------------------------------------ */

        {
            id:
                "anniversary_default",

            automationCategory:
                "anniversary",

            title:
                "Celebrate Your Anniversary With 20% Off",

            discount:
                "20% Off",

            category:
                "% discount",

            occasion:
                "Anniversary",

            imageUrl:
                "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=600&q=80",

            summary:
                "Invite customers to celebrate their special anniversary with a memorable dining offer.",

            audience:
                "Anniversary customers",

            channel:
                "WhatsApp",

            timing:
                "default",
        },


        /* ------------------------------------------------------
           HOLIDAY
           ------------------------------------------------------ */

        {
            id:
                "holiday_season_default",

            automationCategory:
                "holiday",

            title:
                "Celebrate the Season With 15% Off",

            discount:
                "15% Off",

            category:
                "% discount",

            occasion:
                "Holiday Season",

            imageUrl:
                "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=600&q=80",

            summary:
                "Encourage customers to celebrate the festive season with a special restaurant offer.",

            audience:
                "All customers",

            channel:
                "WhatsApp",

            timing:
                "default",
        },


        /* ------------------------------------------------------
           VIP CUSTOMER
           ------------------------------------------------------ */

        {
            id:
                "vip_customer_default",

            automationCategory:
                "vip_customer",

            title:
                "A Special 25% VIP Reward Just for You",

            discount:
                "25% Off",

            category:
                "% discount",

            occasion:
                "VIP Customer",

            imageUrl:
                "https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&w=600&q=80",

            summary:
                "Reward valuable VIP customers with an exclusive premium discount.",

            audience:
                "VIP customers",

            channel:
                "WhatsApp",

            timing:
                "default",
        },
    ];
}


/* ============================================================
   ONE DAY BEFORE TEMPLATES
   ============================================================ */

/**
 * Templates used when the event is one day away.
 */
export function getOneDayBeforeTemplates():
    AutomationTemplate[] {

    return [

        {
            id:
                "new_customer_one_day_before",

            automationCategory:
                "new_customer",

            title:
                "A Special Welcome Offer Is Waiting for You",

            discount:
                "10% Off",

            category:
                "% discount",

            occasion:
                "New Customer",

            imageUrl:
                "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80",

            summary:
                "Prepare a welcoming offer for a new customer one day before the configured campaign event.",

            audience:
                "New customers",

            channel:
                "WhatsApp",

            timing:
                "one_day_before",
        },


        {
            id:
                "inactive_customer_one_day_before",

            automationCategory:
                "inactive_customer",

            title:
                "We Miss You! Your 15% Comeback Offer Is Almost Here",

            discount:
                "15% Off",

            category:
                "% discount",

            occasion:
                "Inactive Customer",

            imageUrl:
                "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=600&q=80",

            summary:
                "Remind inactive customers about a return offer one day before the configured campaign event.",

            audience:
                "Inactive customers",

            channel:
                "WhatsApp",

            timing:
                "one_day_before",
        },


        {
            id:
                "repeat_purchase_one_day_before",

            automationCategory:
                "repeat_purchase",

            title:
                "A FREE Dessert Reward Is Waiting for Your Next Visit",

            discount:
                "Free Dessert",

            category:
                "Free Item",

            occasion:
                "Repeat Purchase",

            imageUrl:
                "https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=600&q=80",

            summary:
                "Encourage another purchase by reminding returning customers about their reward.",

            audience:
                "Repeat customers",

            channel:
                "WhatsApp",

            timing:
                "one_day_before",
        },


        {
            id:
                "birthday_one_day_before",

            automationCategory:
                "birthday",

            title:
                "Your Birthday Is Tomorrow! A FREE Cake Awaits",

            discount:
                "Free Cake",

            category:
                "Free Item",

            occasion:
                "Birthday",

            imageUrl:
                "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80",

            summary:
                "Wish customers ahead of their birthday and invite them to celebrate with a complimentary cake.",

            audience:
                "Birthday customers",

            channel:
                "WhatsApp",

            timing:
                "one_day_before",
        },


        {
            id:
                "anniversary_one_day_before",

            automationCategory:
                "anniversary",

            title:
                "Your Anniversary Is Tomorrow! Celebrate With 20% Off",

            discount:
                "20% Off",

            category:
                "% discount",

            occasion:
                "Anniversary",

            imageUrl:
                "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=600&q=80",

            summary:
                "Remind customers one day before their anniversary and invite them for a special celebration.",

            audience:
                "Anniversary customers",

            channel:
                "WhatsApp",

            timing:
                "one_day_before",
        },


        {
            id:
                "holiday_season_one_day_before",

            automationCategory:
                "holiday",

            title:
                "Celebrate Tomorrow With Our Festive 15% Off",

            discount:
                "15% Off",

            category:
                "% discount",

            occasion:
                "Holiday Season",

            imageUrl:
                "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=600&q=80",

            summary:
                "Promote a festive restaurant offer one day before the upcoming holiday occasion.",

            audience:
                "All customers",

            channel:
                "WhatsApp",

            timing:
                "one_day_before",
        },


        {
            id:
                "vip_customer_one_day_before",

            automationCategory:
                "vip_customer",

            title:
                "Your Exclusive VIP 25% Reward Is Almost Here",

            discount:
                "25% Off",

            category:
                "% discount",

            occasion:
                "VIP Customer",

            imageUrl:
                "https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&w=600&q=80",

            summary:
                "Notify VIP customers one day before their exclusive reward campaign.",

            audience:
                "VIP customers",

            channel:
                "WhatsApp",

            timing:
                "one_day_before",
        },
    ];
}


/* ============================================================
   TWO DAYS BEFORE TEMPLATES
   ============================================================ */

/**
 * Templates used when the event is two days away.
 */
export function getTwoDaysBeforeTemplates():
    AutomationTemplate[] {

    return [

        {
            id:
                "new_customer_two_days_before",

            automationCategory:
                "new_customer",

            title:
                "Something Special Is Coming Your Way",

            discount:
                "10% Off",

            category:
                "% discount",

            occasion:
                "New Customer",

            imageUrl:
                "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80",

            summary:
                "Prepare new customers for an upcoming welcome offer two days before the configured campaign event.",

            audience:
                "New customers",

            channel:
                "WhatsApp",

            timing:
                "two_days_before",
        },


        {
            id:
                "inactive_customer_two_days_before",

            automationCategory:
                "inactive_customer",

            title:
                "We'd Love to See You Again — 15% Off Is Coming",

            discount:
                "15% Off",

            category:
                "% discount",

            occasion:
                "Inactive Customer",

            imageUrl:
                "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=600&q=80",

            summary:
                "Reach inactive customers two days before the configured campaign event with a comeback offer.",

            audience:
                "Inactive customers",

            channel:
                "WhatsApp",

            timing:
                "two_days_before",
        },


        {
            id:
                "repeat_purchase_two_days_before",

            automationCategory:
                "repeat_purchase",

            title:
                "Your FREE Dessert Reward Is Coming Soon",

            discount:
                "Free Dessert",

            category:
                "Free Item",

            occasion:
                "Repeat Purchase",

            imageUrl:
                "https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=600&q=80",

            summary:
                "Build anticipation for a repeat-customer reward two days before the campaign event.",

            audience:
                "Repeat customers",

            channel:
                "WhatsApp",

            timing:
                "two_days_before",
        },


        {
            id:
                "birthday_two_days_before",

            automationCategory:
                "birthday",

            title:
                "Your Birthday Is Almost Here! Celebrate With a FREE Cake",

            discount:
                "Free Cake",

            category:
                "Free Item",

            occasion:
                "Birthday",

            imageUrl:
                "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80",

            summary:
                "Contact customers two days before their birthday and invite them to celebrate at the restaurant.",

            audience:
                "Birthday customers",

            channel:
                "WhatsApp",

            timing:
                "two_days_before",
        },


        {
            id:
                "anniversary_two_days_before",

            automationCategory:
                "anniversary",

            title:
                "Your Anniversary Is Coming Up — Enjoy 20% Off",

            discount:
                "20% Off",

            category:
                "% discount",

            occasion:
                "Anniversary",

            imageUrl:
                "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=600&q=80",

            summary:
                "Invite customers two days before their anniversary to plan a special restaurant celebration.",

            audience:
                "Anniversary customers",

            channel:
                "WhatsApp",

            timing:
                "two_days_before",
        },


        {
            id:
                "holiday_season_two_days_before",

            automationCategory:
                "holiday",

            title:
                "The Festive Celebration Starts Soon — Enjoy 15% Off",

            discount:
                "15% Off",

            category:
                "% discount",

            occasion:
                "Holiday Season",

            imageUrl:
                "https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=600&q=80",

            summary:
                "Promote the restaurant's festive offer two days before the holiday campaign event.",

            audience:
                "All customers",

            channel:
                "WhatsApp",

            timing:
                "two_days_before",
        },


        {
            id:
                "vip_customer_two_days_before",

            automationCategory:
                "vip_customer",

            title:
                "Your Exclusive VIP Reward Is Coming Soon",

            discount:
                "25% Off",

            category:
                "% discount",

            occasion:
                "VIP Customer",

            imageUrl:
                "https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&w=600&q=80",

            summary:
                "Give VIP customers an early notification two days before their exclusive campaign reward.",

            audience:
                "VIP customers",

            channel:
                "WhatsApp",

            timing:
                "two_days_before",
        },
    ];
}


/* ============================================================
   GET TEMPLATE FOR CATEGORY + TIMING
   ============================================================ */

/**
 * This is the main function that trigger.ts should use.
 *
 * The flow is:
 *
 * trigger.ts
 *     ↓
 * getTemplateForCategory()
 *     ↓
 * local config.ts
 *     ↓
 * template
 *
 * No template lookup in Supabase is required.
 */
export function getTemplateForCategory(
    category:
        AutomationCategory,

    timing:
        TemplateTiming = "default",
):
    AutomationTemplate | undefined {

    /* ----------------------------------------------------------
       ONE DAY BEFORE
       ---------------------------------------------------------- */

    if (
        timing ===
        "one_day_before"
    ) {

        return getOneDayBeforeTemplates()
            .find(
                (template) =>
                    template.automationCategory ===
                    category,
            );
    }


    /* ----------------------------------------------------------
       TWO DAYS BEFORE
       ---------------------------------------------------------- */

    if (
        timing ===
        "two_days_before"
    ) {

        return getTwoDaysBeforeTemplates()
            .find(
                (template) =>
                    template.automationCategory ===
                    category,
            );
    }


    /* ----------------------------------------------------------
       DEFAULT / EVENT DAY
       ---------------------------------------------------------- */

    return getDefaultTemplates()
        .find(
            (template) =>
                template.automationCategory ===
                category,
        );
}