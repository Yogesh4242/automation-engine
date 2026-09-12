// src/app/api/send-email/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "contact@enhanzers.com";
const FROM_NAME = process.env.RESEND_FROM_NAME || "Engage";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Extract parameters sent from the frontend
    const {
      to,
      subject,
      storeName,
      subtitle,
      rewardValue,
      ctaText,
      generatedLink,
      headerImage,
      bodyImage,
    } = body;

    // Basic validation — fail fast with a clear error instead of a silent Resend failure
    if (!to) {
      return NextResponse.json({ success: false, error: "Missing 'to' email address" }, { status: 400 });
    }
    if (!subject) {
      return NextResponse.json({ success: false, error: "Missing 'subject'" }, { status: 400 });
    }

    const from = `${storeName || FROM_NAME} <${FROM_EMAIL}>`;

    console.log(`📧 Sending from: ${from} to: ${to}`);

    // Exact email design matching the UI preview
    const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; padding: 24px 0; margin: 0;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5;">
        <tr>
          <td align="center">
            
            <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); margin: 0 auto;">
              
              ${headerImage ? `
              <tr>
                <td>
                  <img src="${headerImage}" alt="Campaign Header" style="width: 100%; display: block; max-height: 250px; object-fit: cover; border-bottom: 1px solid #f3f4f6;" />
                </td>
              </tr>
              ` : ''}

              <tr>
                <td style="padding: 40px 32px; text-align: center;">
                  
                  <h1 style="margin-top: 0; color: #0f172a; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">
                    ${subject || 'Special Offer!'}
                  </h1>
                  
                  <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin-bottom: 32px; padding: 0 10px;">
                    ${subtitle || ''}
                  </p>

                  ${bodyImage ? `
                  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 32px;">
                    <tr>
                      <td align="center">
                        <img src="${bodyImage}" alt="Campaign Body" style="width: 100%; max-width: 320px; display: block; border-radius: 12px; object-fit: cover;" />
                      </td>
                    </tr>
                  </table>
                  ` : ''}

                  ${rewardValue ? `
                  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 32px;">
                    <tr>
                      <td align="center">
                        <div style="background-color: #EEFAF9; border: 1px solid #99F6E4; border-radius: 16px; padding: 24px; max-width: 320px; margin: 0 auto;">
                          <div style="color: #00A79D; font-size: 32px; font-weight: 900; margin-bottom: 8px;">
                            ${rewardValue}% OFF
                          </div>
                          <div style="color: #374151; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">
                            Limited Time Offer
                          </div>
                        </div>
                      </td>
                    </tr>
                  </table>
                  ` : ''}

                  <table width="100%" border="0" cellspacing="0" cellpadding="0">
                    <tr>
                      <td align="center">
                        <a href="${generatedLink || 'https://enhanzers.com'}" style="display: block; max-width: 320px; background-color: #0F172A; color: #ffffff; text-decoration: none; padding: 18px 24px; border-radius: 12px; font-size: 16px; font-weight: bold; text-align: center;">
                          ${ctaText || 'Claim Your Offer'}
                        </a>
                      </td>
                    </tr>
                  </table>

                </td>
              </tr>

            </table>

          </td>
        </tr>
      </table>
    </body>
    </html>
    `;

    const { data, error } = await resend.emails.send({
      from: from,
      to: [to],
      subject: subject,
      html: htmlTemplate,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Send-email route error:", error);
    return NextResponse.json({ success: false, error: "Failed to send email" }, { status: 500 });
  }
}