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
