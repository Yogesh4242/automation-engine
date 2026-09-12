// src/app/api/automation-send/whatsapp/route.ts

import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";


/* ============================================================
   TWILIO
   ============================================================ */

const client = twilio(
  process.env.TWILIO_SID,
  process.env.TWILIO_AUTH_TOKEN,
);


/* ============================================================
   PHONE FORMAT
   ============================================================ */

const DEFAULT_COUNTRY_CODE = "91";


function toE164(phone: string): string {

  const digits =
    phone.replace(/[^\d+]/g, "");


  if (digits.startsWith("+")) {
    return digits;
  }


  if (
    digits.startsWith(
      DEFAULT_COUNTRY_CODE,
    )
  ) {
    return `+${digits}`;
  }


  return `+${DEFAULT_COUNTRY_CODE}${digits}`;
}


/* ============================================================
   AUTOMATION AUTHENTICATION
   ============================================================ */

/**
 * This endpoint is ONLY for server-side automation.
 *
 * It must NOT depend on a Supabase browser session.
 *
 * The engine sends the secret through the internal
 * automation authorization header.
 */
function isAuthorized(
  request: NextRequest,
): boolean {

  const expectedSecret =
    process.env.AUTOMATION_INTERNAL_SECRET;


  if (!expectedSecret) {

    console.error(
      "[AUTOMATION WHATSAPP] AUTOMATION_INTERNAL_SECRET is not configured.",
    );

    return false;
  }


  const providedSecret =
    request.headers.get(
      "x-automation-secret",
    );


  return (
    providedSecret ===
    expectedSecret
  );
}


/* ============================================================
   POST
   ============================================================ */

export async function POST(
  request: NextRequest,
) {

  try {

    /* ========================================================
       1. AUTHENTICATE AUTOMATION ENGINE
       ======================================================== */

    if (
      !isAuthorized(request)
    ) {

      console.error(
        "[AUTOMATION WHATSAPP] Unauthorized automation request.",
      );


      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }


    /* ========================================================
       2. CHECK TWILIO CONFIGURATION
       ======================================================== */

    if (
      !process.env.TWILIO_SID ||
      !process.env.TWILIO_AUTH_TOKEN ||
      !process.env.TWILIO_WHATSAPP_NUMBER
    ) {

      return NextResponse.json(
        {
          success: false,
          error:
            "Twilio environment variables are not configured",
        },
        {
          status: 500,
        },
      );
    }


    /* ========================================================
       3. READ REQUEST
       ======================================================== */

    const {
      to,
      message,
      templateData,
    } =
      await request.json();


    if (
      !to ||
      !message
    ) {

      return NextResponse.json(
        {
          success: false,
          error:
            "Missing 'to' or 'message'",
        },
        {
          status: 400,
        },
      );
    }


    /* ========================================================
       4. FORMAT PHONE NUMBER
       ======================================================== */

    const toNumber =
      `whatsapp:${toE164(to)}`;


    /* ========================================================
       5. LOAD WHATSAPP TEMPLATE
       ======================================================== */

    const templateSid =
      process.env.TWILIO_WHATSAPP_TEMPLATE_SID;


    let twilioMessage;


    /* ========================================================
       6. SEND APPROVED TEMPLATE
       ======================================================== */

    if (
      templateSid &&
      templateData
    ) {

      twilioMessage =
        await client.messages.create({

          from:
            process.env
              .TWILIO_WHATSAPP_NUMBER,

          to:
            toNumber,

          contentSid:
            templateSid,

          contentVariables:
            JSON.stringify({

              "1":
                templateData.storeName ||
                "Our Restaurant",

              "2":
                templateData.detail1 ||
                "",

              "3":
                templateData.detail2 ||
                "",

              "4":
                templateData.detail3 ||
                "",

              "5":
                templateData.rewardValue ||
                "20",

              "6":
                templateData.offerCode ||
                "WELCOME2024",

              "7":
                templateData.campaignSlug ||
                "campaign",
            }),
        });

    }


    /* ========================================================
       7. FALLBACK MESSAGE
       ======================================================== */

    else {

      const messageWithButton =
        `${message}\n\n👉 Claim your offer: ${
          templateData?.campaignLink ||
          templateData?.campaignSlug ||
          "https://enhanzers.com"
        }`;


      twilioMessage =
        await client.messages.create({

          from:
            process.env
              .TWILIO_WHATSAPP_NUMBER,

          to:
            toNumber,

          body:
            messageWithButton,
        });
    }


    /* ========================================================
       8. SUCCESS
       ======================================================== */

    console.log(
      `[AUTOMATION WHATSAPP] Message sent → ${to}`,
    );


    return NextResponse.json({

      success: true,

      sid:
        twilioMessage.sid,

      status:
        twilioMessage.status,
    });


  } catch (error: any) {

    console.error(
      "[AUTOMATION WHATSAPP] Send error:",
      error,
    );


    return NextResponse.json(
      {
        success: false,

        error:
          error?.message ||
          "Failed to send WhatsApp message",

        code:
          error?.code,
      },
      {
        status: 500,
      },
    );
  }
}