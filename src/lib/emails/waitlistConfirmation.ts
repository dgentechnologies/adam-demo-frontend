const LOGO_URL = 'https://adam-demo-frontend.vercel.app/images/logo.png';

export function buildWaitlistConfirmationEmail(name: string): string {
  const displayName = name.trim() || 'there';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're on the ADAM Waitlist</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#080b0e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

  <!-- Preheader text (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    You're officially on the ADAM waitlist. Welcome to the future of AI.&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
  </div>

  <!-- Email wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#080b0e;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <!-- Card container -->
        <table role="presentation" width="100%" style="max-width:580px;" cellpadding="0" cellspacing="0">

          <!-- Header / Logo area -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <img src="${LOGO_URL}" alt="DGEN Technologies" width="140" height="auto"
                style="display:block;max-width:140px;height:auto;" />
            </td>
          </tr>

          <!-- Main card -->
          <tr>
            <td style="background:linear-gradient(160deg,#0f1a14 0%,#0d1410 40%,#080b0e 100%);border:1px solid rgba(25,179,92,0.18);border-radius:16px;overflow:hidden;">

              <!-- Green top accent bar -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="height:3px;background:linear-gradient(90deg,#19b35c 0%,#0ef07e 50%,#19b35c 100%);"></td>
                </tr>
              </table>

              <!-- Body content -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:44px 40px 36px;">

                    <!-- Icon badge -->
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                      <tr>
                        <td style="background:rgba(25,179,92,0.1);border:1px solid rgba(25,179,92,0.3);border-radius:12px;padding:12px 16px;">
                          <span style="font-size:22px;line-height:1;">&#x2713;&nbsp;</span>
                          <span style="color:#19b35c;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;vertical-align:middle;">Waitlist Confirmed</span>
                        </td>
                      </tr>
                    </table>

                    <!-- Headline -->
                    <h1 style="margin:0 0 12px;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.02em;line-height:1.25;">
                      Welcome aboard, ${displayName}.
                    </h1>

                    <!-- Sub-headline -->
                    <p style="margin:0 0 28px;color:#a0adb8;font-size:16px;line-height:1.6;">
                      You've secured your spot on the <strong style="color:#e8edf2;">ADAM waitlist</strong>. We'll reach out the moment your access is ready.
                    </p>

                    <!-- Divider -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                      <tr>
                        <td style="height:1px;background:rgba(255,255,255,0.06);"></td>
                      </tr>
                    </table>

                    <!-- What is ADAM section -->
                    <p style="margin:0 0 16px;color:#7a8895;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;">What you're waiting for</p>

                    <!-- Feature rows -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                      <tr>
                        <td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                          <table role="presentation" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="width:32px;vertical-align:top;">
                                <span style="display:inline-block;width:20px;height:20px;background:rgba(25,179,92,0.15);border-radius:50%;text-align:center;line-height:20px;font-size:11px;color:#19b35c;">&#9670;</span>
                              </td>
                              <td style="padding-left:12px;">
                                <p style="margin:0;color:#d4dde6;font-size:14px;font-weight:600;">Voice-First AI Intelligence</p>
                                <p style="margin:4px 0 0;color:#6b7885;font-size:13px;">Natural conversation, sub-200ms response, multilingual.</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                          <table role="presentation" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="width:32px;vertical-align:top;">
                                <span style="display:inline-block;width:20px;height:20px;background:rgba(25,179,92,0.15);border-radius:50%;text-align:center;line-height:20px;font-size:11px;color:#19b35c;">&#9670;</span>
                              </td>
                              <td style="padding-left:12px;">
                                <p style="margin:0;color:#d4dde6;font-size:14px;font-weight:600;">Desktop-Native Hardware</p>
                                <p style="margin:4px 0 0;color:#6b7885;font-size:13px;">Matte-black unit with servo neck, OLED face, and local vision.</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:12px 0;">
                          <table role="presentation" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="width:32px;vertical-align:top;">
                                <span style="display:inline-block;width:20px;height:20px;background:rgba(25,179,92,0.15);border-radius:50%;text-align:center;line-height:20px;font-size:11px;color:#19b35c;">&#9670;</span>
                              </td>
                              <td style="padding-left:12px;">
                                <p style="margin:0;color:#d4dde6;font-size:14px;font-weight:600;">Persistent Memory</p>
                                <p style="margin:4px 0 0;color:#6b7885;font-size:13px;">ADAM remembers your preferences, routines, and context.</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- CTA button -->
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                      <tr>
                        <td style="border-radius:10px;background:linear-gradient(135deg,#19b35c 0%,#0ef07e 100%);box-shadow:0 4px 24px rgba(25,179,92,0.35);">
                          <a href="https://dgentechnologies.com/products/adam"
                            style="display:inline-block;padding:14px 32px;color:#050f09;font-size:14px;font-weight:700;letter-spacing:0.02em;text-decoration:none;">
                            Explore ADAM &rarr;
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Divider -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                      <tr>
                        <td style="height:1px;background:rgba(255,255,255,0.06);"></td>
                      </tr>
                    </table>

                    <!-- Closing note -->
                    <p style="margin:0;color:#5a6470;font-size:13px;line-height:1.7;">
                      You'll only hear from us when it matters&nbsp;&mdash;&nbsp;no spam, no noise.<br/>
                      If you have questions, reply directly to this email.
                    </p>

                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:28px 0 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:12px;">
                    <p style="margin:0;color:#2e3840;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;font-weight:600;">
                      DGEN Technologies Pvt. Ltd.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <p style="margin:0;color:#2e3840;font-size:12px;">
                      Kolkata, India &nbsp;&bull;&nbsp; <a href="https://dgentechnologies.com" style="color:#19b35c;text-decoration:none;">dgentechnologies.com</a>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top:16px;">
                    <p style="margin:0;color:#1e262c;font-size:11px;font-style:italic;">
                      Innovate. Integrate. Inspire. &nbsp;|&nbsp; Made in India.
                    </p>
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
</html>`;
}
