import nodemailer from "nodemailer";

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
    auth: {
      user: process.env.EMAIL_SERVER_USER,
      pass: process.env.EMAIL_SERVER_PASSWORD,
    },
  });
}

const FROM = process.env.EMAIL_FROM ?? "no-reply@buybacksite.com";

// ─── Order Confirmation ────────────────────────────────────────────────────────

interface OrderConfirmationData {
  to: string;
  sellerName: string;
  orderNumber: string;
  deviceName: string;
  storageGb: number;
  carrier: string;
  conditionLabel: string;
  quotedPrice: number;
  payoutMethod: string;
  shippingName: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingZip: string;
  shopName: string;
  shopPhone: string;
}

export async function sendOrderConfirmation(data: OrderConfirmationData) {
  const {
    to, sellerName, orderNumber, deviceName, storageGb, carrier,
    conditionLabel, quotedPrice, payoutMethod, shippingName,
    shippingAddress, shippingCity, shippingState, shippingZip,
    shopName, shopPhone,
  } = data;

  const storageLabel = storageGb >= 1024 ? "1TB" : `${storageGb}GB`;
  const carrierLabel = carrier === "UNLOCKED" ? "Unlocked" : carrier.replace("TMOBILE", "T-Mobile");
  const payoutLabel = payoutMethod.charAt(0) + payoutMethod.slice(1).toLowerCase().replace("_", " ");
  const priceFormatted = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(quotedPrice);

  const subject = `Offer confirmed — ${priceFormatted} for your ${deviceName} | ${orderNumber}`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; color: #111; }
    .wrap { max-width: 560px; margin: 32px auto; background: #fff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; }
    .header { background: #1d4ed8; padding: 32px 36px; }
    .header h1 { margin: 0; color: #fff; font-size: 22px; font-weight: 700; }
    .header p { margin: 6px 0 0; color: #bfdbfe; font-size: 14px; }
    .body { padding: 32px 36px; }
    .price-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 20px 24px; margin: 20px 0; text-align: center; }
    .price-box .amount { font-size: 40px; font-weight: 800; color: #1d4ed8; line-height: 1; }
    .price-box .device { font-size: 14px; color: #6b7280; margin-top: 6px; }
    .section { margin: 24px 0; }
    .section h3 { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin: 0 0 10px; }
    .info-row { display: flex; gap: 8px; padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #6b7280; min-width: 130px; flex-shrink: 0; }
    .address-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; font-size: 14px; line-height: 1.6; }
    .steps { margin: 24px 0; }
    .step { display: flex; gap: 14px; margin-bottom: 16px; align-items: flex-start; }
    .step-num { width: 26px; height: 26px; border-radius: 50%; background: #1d4ed8; color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
    .step-text { font-size: 14px; line-height: 1.5; color: #374151; }
    .footer { padding: 20px 36px; border-top: 1px solid #f3f4f6; font-size: 12px; color: #9ca3af; text-align: center; }
    p { font-size: 14px; line-height: 1.6; color: #374151; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>${shopName}</h1>
      <p>Buyback Offer Confirmation · ${orderNumber}</p>
    </div>
    <div class="body">
      <p>Hi ${sellerName},</p>
      <p>We've received your offer request and locked in your price. Here's your confirmed offer:</p>

      <div class="price-box">
        <div class="amount">${priceFormatted}</div>
        <div class="device">${deviceName} · ${storageLabel} · ${carrierLabel} · ${conditionLabel}</div>
      </div>

      <div class="section">
        <h3>Order Details</h3>
        <div class="info-row"><span class="info-label">Order #</span><strong>${orderNumber}</strong></div>
        <div class="info-row"><span class="info-label">Device</span>${deviceName} ${storageLabel}</div>
        <div class="info-row"><span class="info-label">Carrier</span>${carrierLabel}</div>
        <div class="info-row"><span class="info-label">Condition</span>${conditionLabel}</div>
        <div class="info-row"><span class="info-label">Payout Method</span>${payoutLabel}</div>
      </div>

      <div class="section">
        <h3>Ship Your Device To</h3>
        <div class="address-box">
          <strong>${shippingName}</strong><br>
          ${shippingAddress}<br>
          ${shippingCity}, ${shippingState} ${shippingZip}
        </div>
      </div>

      <div class="steps">
        <h3 style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;margin:0 0 14px;">What Happens Next</h3>
        <div class="step">
          <div class="step-num">1</div>
          <div class="step-text"><strong>Pack your device securely</strong> — use the original box if you have it, or wrap in bubble wrap. Include all chargers and accessories you want to send.</div>
        </div>
        <div class="step">
          <div class="step-num">2</div>
          <div class="step-text"><strong>Ship to the address above</strong> — write order <strong>${orderNumber}</strong> on the outside of the package. We recommend using a tracked shipping service.</div>
        </div>
        <div class="step">
          <div class="step-num">3</div>
          <div class="step-text"><strong>We inspect your device</strong> — once received (usually within 1 business day), we inspect it and confirm the condition.</div>
        </div>
        <div class="step">
          <div class="step-num">4</div>
          <div class="step-text"><strong>Get paid</strong> — payment via ${payoutLabel} is sent within 1–2 business days of inspection approval. You'll receive a confirmation email.</div>
        </div>
      </div>

      <p>Questions? Call or text us at <strong>${shopPhone}</strong>. Reference order ${orderNumber}.</p>
    </div>
    <div class="footer">
      ${shopName} · This email confirms your buyback order. Do not reply to this email.
    </div>
  </div>
</body>
</html>`;

  const text = `Hi ${sellerName},

Your offer is confirmed: ${priceFormatted} for your ${deviceName} ${storageLabel} (${conditionLabel}).
Order #: ${orderNumber}

Ship to:
${shippingName}
${shippingAddress}
${shippingCity}, ${shippingState} ${shippingZip}

Write ${orderNumber} on the outside of your package.

Questions? Call ${shopPhone}.`;

  try {
    const transport = createTransport();
    await transport.sendMail({ from: FROM, to, subject, html, text });
  } catch (err) {
    console.error("[email] Failed to send order confirmation:", err);
    // Don't throw — order is already created, email failure is non-fatal
  }
}

// ─── New Order Alert (to shop owner) ──────────────────────────────────────────

interface NewOrderAlertData {
  to: string;
  orderNumber: string;
  deviceName: string;
  storageGb: number;
  conditionLabel: string;
  quotedPrice: number;
  sellerName: string;
  sellerEmail: string;
  dashboardUrl: string;
}

export async function sendNewOrderAlert(data: NewOrderAlertData) {
  const { to, orderNumber, deviceName, storageGb, conditionLabel, quotedPrice, sellerName, sellerEmail, dashboardUrl } = data;
  const priceFormatted = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(quotedPrice);
  const storage = storageGb >= 1024 ? "1TB" : `${storageGb}GB`;

  const subject = `New buyback order — ${deviceName} ${storage} (${priceFormatted}) | ${orderNumber}`;
  const text = `New order received!\n\nOrder: ${orderNumber}\nDevice: ${deviceName} ${storage} · ${conditionLabel}\nOffer: ${priceFormatted}\nSeller: ${sellerName} <${sellerEmail}>\n\nView order: ${dashboardUrl}`;

  try {
    const transport = createTransport();
    await transport.sendMail({ from: FROM, to, subject, text });
  } catch (err) {
    console.error("[email] Failed to send new order alert:", err);
  }
}

// ─── Status Change Notifications (to seller) ──────────────────────────────────

interface StatusEmailBase {
  to: string;
  sellerName: string;
  orderNumber: string;
  deviceName: string;
  shopName: string;
  shopPhone: string;
}

function statusEmailWrap(shopName: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;}
    .wrap{max-width:520px;margin:32px auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;}
    .header{background:#1d4ed8;padding:24px 32px;}<br/>.header h1{margin:0;color:#fff;font-size:18px;font-weight:700;}
    .body{padding:28px 32px;font-size:14px;line-height:1.6;color:#374151;}
    .footer{padding:16px 32px;border-top:1px solid #f3f4f6;font-size:12px;color:#9ca3af;}
  </style></head><body><div class="wrap">
  <div class="header"><h1>${shopName}</h1></div>
  <div class="body">${body}</div>
  <div class="footer">${shopName} · Reply to this email or call us with questions.</div>
  </div></body></html>`;
}

export async function sendStatusEmail(
  status: string,
  base: StatusEmailBase,
  extra: Record<string, string | number> = {}
) {
  const { to, sellerName, orderNumber, deviceName, shopName, shopPhone } = base;
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  type Template = { subject: string; html: string; text: string };

  const templates: Partial<Record<string, Template>> = {
    RECEIVED: {
      subject: `We received your ${deviceName} | ${orderNumber}`,
      html: statusEmailWrap(shopName, `<p>Hi ${sellerName},</p>
        <p>Great news — your <strong>${deviceName}</strong> arrived safely (order <strong>${orderNumber}</strong>).</p>
        <p>We'll begin inspection within <strong>1 business day</strong> and notify you of the result. No action needed from you.</p>
        <p>Questions? Call or text <strong>${shopPhone}</strong>.</p>`),
      text: `Hi ${sellerName},\n\nYour ${deviceName} arrived (order ${orderNumber}). Inspection starts within 1 business day.\n\nQuestions? Call ${shopPhone}.`,
    },
    OFFER_REVISED: {
      subject: `Revised offer for your ${deviceName} | ${orderNumber}`,
      html: statusEmailWrap(shopName, `<p>Hi ${sellerName},</p>
        <p>After inspecting your <strong>${deviceName}</strong> (order <strong>${orderNumber}</strong>), we found the condition differs from what was selected.</p>
        <p>Our revised offer is: <strong style="font-size:22px;color:#1d4ed8">${fmt(Number(extra.finalPrice ?? 0))}</strong></p>
        ${extra.note ? `<p><em>Inspector note: ${extra.note}</em></p>` : ""}
        <p>Please reply to accept or decline this revised offer. If we don't hear back within <strong>5 business days</strong>, we'll return your device.</p>
        <p>Questions? Call or text <strong>${shopPhone}</strong>.</p>`),
      text: `Hi ${sellerName},\n\nRevised offer for order ${orderNumber}: ${fmt(Number(extra.finalPrice ?? 0))}\n${extra.note ? `Note: ${extra.note}\n` : ""}\nReply to accept or decline within 5 business days.\n\nCall ${shopPhone} with questions.`,
    },
    APPROVED: {
      subject: `Offer approved — payment on the way | ${orderNumber}`,
      html: statusEmailWrap(shopName, `<p>Hi ${sellerName},</p>
        <p>Your <strong>${deviceName}</strong> passed inspection (order <strong>${orderNumber}</strong>). 🎉</p>
        <p>Your payment of <strong style="font-size:20px;color:#16a34a">${fmt(Number(extra.finalPrice ?? extra.quotedPrice ?? 0))}</strong> is being processed and will be sent within <strong>1–2 business days</strong>.</p>
        <p>You'll receive one more email when the payment goes out.</p>
        <p>Thank you for selling with ${shopName}!</p>`),
      text: `Hi ${sellerName},\n\nYour ${deviceName} passed inspection (order ${orderNumber}). Payment of ${fmt(Number(extra.finalPrice ?? extra.quotedPrice ?? 0))} is on its way within 1-2 business days.\n\nThank you!`,
    },
    PAID: {
      subject: `Payment sent! | ${orderNumber}`,
      html: statusEmailWrap(shopName, `<p>Hi ${sellerName},</p>
        <p>Your payment for order <strong>${orderNumber}</strong> has been sent!</p>
        <p><strong>Amount:</strong> ${fmt(Number(extra.finalPrice ?? extra.quotedPrice ?? 0))}<br>
        <strong>Method:</strong> ${extra.payoutMethod ?? ""}<br>
        ${extra.payoutReference ? `<strong>Reference:</strong> ${extra.payoutReference}` : ""}</p>
        <p>Thank you for doing business with <strong>${shopName}</strong>. We'd love to buy from you again!</p>`),
      text: `Hi ${sellerName},\n\nPayment sent for order ${orderNumber}!\nAmount: ${fmt(Number(extra.finalPrice ?? extra.quotedPrice ?? 0))}\nMethod: ${extra.payoutMethod ?? ""}\n${extra.payoutReference ? `Reference: ${extra.payoutReference}\n` : ""}\nThank you!`,
    },
    REJECTED: {
      subject: `Update on your ${deviceName} | ${orderNumber}`,
      html: statusEmailWrap(shopName, `<p>Hi ${sellerName},</p>
        <p>Unfortunately, we're unable to accept your <strong>${deviceName}</strong> (order <strong>${orderNumber}</strong>).</p>
        ${extra.note ? `<p><strong>Reason:</strong> ${extra.note}</p>` : ""}
        <p>We'll return your device to you free of charge. You'll receive a tracking number once it ships.</p>
        <p>Questions? Call or text <strong>${shopPhone}</strong>.</p>`),
      text: `Hi ${sellerName},\n\nWe can't accept your ${deviceName} (order ${orderNumber}).${extra.note ? `\nReason: ${extra.note}` : ""}\n\nWe'll return your device. Call ${shopPhone} with questions.`,
    },
    RETURNED: {
      subject: `Your device has been shipped back | ${orderNumber}`,
      html: statusEmailWrap(shopName, `<p>Hi ${sellerName},</p>
        <p>Your <strong>${deviceName}</strong> (order <strong>${orderNumber}</strong>) has been shipped back to you.</p>
        ${extra.trackingNumber ? `<p><strong>Tracking number:</strong> ${extra.trackingNumber}${extra.carrierName ? ` (${extra.carrierName})` : ""}</p>` : ""}
        <p>Please allow 3–7 business days for delivery.</p>
        <p>Questions? Call or text <strong>${shopPhone}</strong>.</p>`),
      text: `Hi ${sellerName},\n\nYour ${deviceName} (order ${orderNumber}) has been shipped back.${extra.trackingNumber ? `\nTracking: ${extra.trackingNumber}` : ""}\n\nCall ${shopPhone} with questions.`,
    },
  };

  const tmpl = templates[status];
  if (!tmpl) return; // no email for this status

  try {
    const transport = createTransport();
    await transport.sendMail({ from: FROM, to, subject: tmpl.subject, html: tmpl.html, text: tmpl.text });
  } catch (err) {
    console.error(`[email] Failed to send ${status} notification:`, err);
  }
}
