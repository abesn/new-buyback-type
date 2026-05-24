const { Resend } = require('resend');

// Lazy-initialize so the module loads safely even without the env var set;
// actual sends will fail if the key is missing, which is the expected behavior.
let _resend = null;
function getResend() {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY || 'placeholder');
  }
  return _resend;
}

function buildEmailHtml({ customerInfo, quoteData, vendorData }) {
  const {
    name, email, phone,
    address, city, state, zip,
    paymentMethod, paymentDetails
  } = customerInfo;

  const { device, carrier, condition, our_quote, quoted_at } = quoteData;
  const { market_prices, average_market_price } = vendorData || {};

  const vendorRows = market_prices
    ? Object.entries(market_prices)
        .map(([key, v]) => `
          <tr>
            <td style="padding:6px 12px;border:1px solid #e0e0e0;">${v.name}</td>
            <td style="padding:6px 12px;border:1px solid #e0e0e0;text-align:right;">$${v.price.toFixed(2)}</td>
          </tr>`)
        .join('')
    : '<tr><td colspan="2" style="padding:6px 12px;">No vendor data available</td></tr>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>New Buyback Lead</title>
</head>
<body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="color:#1a1a2e;border-bottom:2px solid #e63946;padding-bottom:8px;">
    New Buyback Lead: ${device}
  </h2>

  <h3 style="color:#457b9d;margin-top:24px;">Device &amp; Quote Details</h3>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
    <tr>
      <td style="padding:6px 12px;border:1px solid #e0e0e0;font-weight:bold;">Device</td>
      <td style="padding:6px 12px;border:1px solid #e0e0e0;">${device}</td>
    </tr>
    <tr>
      <td style="padding:6px 12px;border:1px solid #e0e0e0;font-weight:bold;">Carrier</td>
      <td style="padding:6px 12px;border:1px solid #e0e0e0;">${carrier}</td>
    </tr>
    <tr>
      <td style="padding:6px 12px;border:1px solid #e0e0e0;font-weight:bold;">Condition</td>
      <td style="padding:6px 12px;border:1px solid #e0e0e0;">${condition}</td>
    </tr>
    <tr>
      <td style="padding:6px 12px;border:1px solid #e0e0e0;font-weight:bold;">Our Quote</td>
      <td style="padding:6px 12px;border:1px solid #e0e0e0;font-size:1.2em;color:#2d6a4f;font-weight:bold;">$${our_quote.toFixed(2)}</td>
    </tr>
    <tr>
      <td style="padding:6px 12px;border:1px solid #e0e0e0;font-weight:bold;">Quoted At</td>
      <td style="padding:6px 12px;border:1px solid #e0e0e0;">${new Date(quoted_at).toLocaleString('en-US', { timeZone: 'UTC' })} UTC</td>
    </tr>
  </table>

  <h3 style="color:#457b9d;margin-top:24px;">Market Intelligence (Internal)</h3>
  <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
    <thead>
      <tr style="background:#f0f4f8;">
        <th style="padding:6px 12px;border:1px solid #e0e0e0;text-align:left;">Vendor</th>
        <th style="padding:6px 12px;border:1px solid #e0e0e0;text-align:right;">Price</th>
      </tr>
    </thead>
    <tbody>
      ${vendorRows}
    </tbody>
  </table>
  ${average_market_price != null
    ? `<p style="margin:4px 0 16px;"><strong>Average Market Price:</strong> $${average_market_price.toFixed(2)}</p>`
    : ''}

  <h3 style="color:#457b9d;margin-top:24px;">Customer Information</h3>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
    <tr>
      <td style="padding:6px 12px;border:1px solid #e0e0e0;font-weight:bold;">Name</td>
      <td style="padding:6px 12px;border:1px solid #e0e0e0;">${name}</td>
    </tr>
    <tr>
      <td style="padding:6px 12px;border:1px solid #e0e0e0;font-weight:bold;">Email</td>
      <td style="padding:6px 12px;border:1px solid #e0e0e0;"><a href="mailto:${email}">${email}</a></td>
    </tr>
    <tr>
      <td style="padding:6px 12px;border:1px solid #e0e0e0;font-weight:bold;">Phone</td>
      <td style="padding:6px 12px;border:1px solid #e0e0e0;">${phone}</td>
    </tr>
  </table>

  <h3 style="color:#457b9d;margin-top:24px;">Shipping Address</h3>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
    <tr>
      <td style="padding:6px 12px;border:1px solid #e0e0e0;font-weight:bold;">Street</td>
      <td style="padding:6px 12px;border:1px solid #e0e0e0;">${address}</td>
    </tr>
    <tr>
      <td style="padding:6px 12px;border:1px solid #e0e0e0;font-weight:bold;">City</td>
      <td style="padding:6px 12px;border:1px solid #e0e0e0;">${city}</td>
    </tr>
    <tr>
      <td style="padding:6px 12px;border:1px solid #e0e0e0;font-weight:bold;">State</td>
      <td style="padding:6px 12px;border:1px solid #e0e0e0;">${state}</td>
    </tr>
    <tr>
      <td style="padding:6px 12px;border:1px solid #e0e0e0;font-weight:bold;">ZIP</td>
      <td style="padding:6px 12px;border:1px solid #e0e0e0;">${zip}</td>
    </tr>
  </table>

  <h3 style="color:#457b9d;margin-top:24px;">Payment Preference</h3>
  <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
    <tr>
      <td style="padding:6px 12px;border:1px solid #e0e0e0;font-weight:bold;">Method</td>
      <td style="padding:6px 12px;border:1px solid #e0e0e0;">${paymentMethod}</td>
    </tr>
    <tr>
      <td style="padding:6px 12px;border:1px solid #e0e0e0;font-weight:bold;">Details</td>
      <td style="padding:6px 12px;border:1px solid #e0e0e0;">${paymentDetails}</td>
    </tr>
  </table>

  <p style="color:#888;font-size:0.85em;border-top:1px solid #eee;padding-top:12px;margin-top:24px;">
    This is an automated lead notification from the Buyback Quote system.
  </p>
</body>
</html>`;
}

async function sendLeadNotification({ customerInfo, quoteData, vendorData }) {
  await getResend().emails.send({
    from: 'Buyback Quote <quotes@resend.dev>',
    to: process.env.NOTIFICATION_EMAIL,
    subject: `New Buyback Lead: ${quoteData.device}`,
    html: buildEmailHtml({ customerInfo, quoteData, vendorData })
  });
}

module.exports = { sendLeadNotification };
