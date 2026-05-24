/* ============================================================
   BuyBack Quote — app.js
   Pure vanilla JS state machine, no dependencies
   ============================================================ */

'use strict';

/* --- Configuration ----------------------------------------- */
const API_BASE = window.API_BASE || 'http://localhost:3001';

/* --- Device Data ------------------------------------------- */
const DEVICE_DATA = {
  apple: {
    label: "Apple",
    icon: "🍎",
    models: {
      "iphone-16-pro-max": { label: "iPhone 16 Pro Max", storage: ["256GB", "512GB", "1TB"] },
      "iphone-16-pro":     { label: "iPhone 16 Pro",     storage: ["128GB", "256GB", "512GB", "1TB"] },
      "iphone-16-plus":    { label: "iPhone 16 Plus",    storage: ["128GB", "256GB", "512GB"] },
      "iphone-16":         { label: "iPhone 16",         storage: ["128GB", "256GB", "512GB"] },
      "iphone-15-pro-max": { label: "iPhone 15 Pro Max", storage: ["256GB", "512GB", "1TB"] },
      "iphone-15-pro":     { label: "iPhone 15 Pro",     storage: ["128GB", "256GB", "512GB", "1TB"] },
      "iphone-15-plus":    { label: "iPhone 15 Plus",    storage: ["128GB", "256GB", "512GB"] },
      "iphone-15":         { label: "iPhone 15",         storage: ["128GB", "256GB", "512GB"] },
      "iphone-14-pro-max": { label: "iPhone 14 Pro Max", storage: ["128GB", "256GB", "512GB", "1TB"] },
      "iphone-14-pro":     { label: "iPhone 14 Pro",     storage: ["128GB", "256GB", "512GB", "1TB"] },
      "iphone-14-plus":    { label: "iPhone 14 Plus",    storage: ["128GB", "256GB", "512GB"] },
      "iphone-14":         { label: "iPhone 14",         storage: ["128GB", "256GB", "512GB"] },
      "iphone-13-pro-max": { label: "iPhone 13 Pro Max", storage: ["128GB", "256GB", "512GB", "1TB"] },
      "iphone-13-pro":     { label: "iPhone 13 Pro",     storage: ["128GB", "256GB", "512GB", "1TB"] },
      "iphone-13":         { label: "iPhone 13",         storage: ["128GB", "256GB", "512GB"] },
      "iphone-13-mini":    { label: "iPhone 13 Mini",    storage: ["128GB", "256GB", "512GB"] },
      "iphone-se-2022":    { label: "iPhone SE (2022)",  storage: ["64GB", "128GB", "256GB"] },
    }
  },
  samsung: {
    label: "Samsung",
    icon: "📱",
    models: {
      "samsung-galaxy-s25-ultra":    { label: "Galaxy S25 Ultra",   storage: ["256GB", "512GB", "1TB"] },
      "samsung-galaxy-s25-plus":     { label: "Galaxy S25+",        storage: ["256GB", "512GB"] },
      "samsung-galaxy-s25":          { label: "Galaxy S25",         storage: ["128GB", "256GB"] },
      "samsung-galaxy-s24-ultra":    { label: "Galaxy S24 Ultra",   storage: ["256GB", "512GB", "1TB"] },
      "samsung-galaxy-s24-plus":     { label: "Galaxy S24+",        storage: ["256GB", "512GB"] },
      "samsung-galaxy-s24":          { label: "Galaxy S24",         storage: ["128GB", "256GB"] },
      "samsung-galaxy-s23-ultra":    { label: "Galaxy S23 Ultra",   storage: ["256GB", "512GB", "1TB"] },
      "samsung-galaxy-z-fold-6":     { label: "Galaxy Z Fold 6",    storage: ["256GB", "512GB", "1TB"] },
      "samsung-galaxy-z-flip-6":     { label: "Galaxy Z Flip 6",    storage: ["256GB", "512GB"] },
      "samsung-galaxy-a55":          { label: "Galaxy A55",         storage: ["128GB", "256GB"] },
    }
  },
  google: {
    label: "Google",
    icon: "🔍",
    models: {
      "google-pixel-9-pro-xl": { label: "Pixel 9 Pro XL", storage: ["128GB", "256GB", "512GB", "1TB"] },
      "google-pixel-9-pro":    { label: "Pixel 9 Pro",    storage: ["128GB", "256GB", "512GB", "1TB"] },
      "google-pixel-9":        { label: "Pixel 9",        storage: ["128GB", "256GB"] },
      "google-pixel-8-pro":    { label: "Pixel 8 Pro",    storage: ["128GB", "256GB", "512GB", "1TB"] },
      "google-pixel-8":        { label: "Pixel 8",        storage: ["128GB", "256GB"] },
      "google-pixel-7-pro":    { label: "Pixel 7 Pro",    storage: ["128GB", "256GB", "512GB"] },
      "google-pixel-7":        { label: "Pixel 7",        storage: ["128GB", "256GB"] },
    }
  },
  motorola: {
    label: "Motorola",
    icon: "〽️",
    models: {
      "motorola-edge-50-pro":        { label: "Edge 50 Pro",       storage: ["256GB", "512GB"] },
      "motorola-edge-50":            { label: "Edge 50",           storage: ["256GB"] },
      "motorola-razr-plus-2024":     { label: "Razr+ 2024",        storage: ["256GB", "512GB"] },
      "motorola-razr-2024":          { label: "Razr 2024",         storage: ["128GB", "256GB"] },
      "motorola-moto-g-stylus-2024": { label: "Moto G Stylus 2024",storage: ["256GB"] },
    }
  },
  oneplus: {
    label: "OnePlus",
    icon: "1️⃣",
    models: {
      "oneplus-12":   { label: "OnePlus 12",   storage: ["256GB", "512GB"] },
      "oneplus-12r":  { label: "OnePlus 12R",  storage: ["128GB", "256GB"] },
      "oneplus-11":   { label: "OnePlus 11",   storage: ["128GB", "256GB"] },
      "oneplus-open": { label: "OnePlus Open", storage: ["512GB"] },
    }
  }
};

const CARRIERS = [
  { value: "unlocked", label: "Unlocked" },
  { value: "verizon",  label: "Verizon" },
  { value: "att",      label: "AT&T" },
  { value: "t-mobile", label: "T-Mobile" },
  { value: "other",    label: "Other / Unknown" }
];

const CONDITIONS = [
  { value: "like-new", label: "Like New",       desc: "Flawless, no scratches" },
  { value: "good",     label: "Good",           desc: "Minor wear, fully functional" },
  { value: "fair",     label: "Fair",           desc: "Visible wear, works fine" },
  { value: "poor",     label: "Poor / Broken",  desc: "Damaged or not working" }
];

const US_STATES = [
  ["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],
  ["CA","California"],["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],
  ["FL","Florida"],["GA","Georgia"],["HI","Hawaii"],["ID","Idaho"],
  ["IL","Illinois"],["IN","Indiana"],["IA","Iowa"],["KS","Kansas"],
  ["KY","Kentucky"],["LA","Louisiana"],["ME","Maine"],["MD","Maryland"],
  ["MA","Massachusetts"],["MI","Michigan"],["MN","Minnesota"],["MS","Mississippi"],
  ["MO","Missouri"],["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],
  ["NH","New Hampshire"],["NJ","New Jersey"],["NM","New Mexico"],["NY","New York"],
  ["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],["OK","Oklahoma"],
  ["OR","Oregon"],["PA","Pennsylvania"],["RI","Rhode Island"],["SC","South Carolina"],
  ["SD","South Dakota"],["TN","Tennessee"],["TX","Texas"],["UT","Utah"],
  ["VT","Vermont"],["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],
  ["WI","Wisconsin"],["WY","Wyoming"],["DC","District of Columbia"]
];

/* --- State ------------------------------------------------- */
const state = {
  step: 1,
  category: null,
  brand: null,
  model: null,
  storage: null,
  carrier: null,
  condition: null,
  quote: null,
  showLeadForm: false,
  confirmed: false,
};

/* --- XSS helper -------------------------------------------- */
function esc(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(String(str)));
  return d.innerHTML;
}

/* --- DOM refs ---------------------------------------------- */
const appEl       = document.getElementById('app');
const progressBar = document.getElementById('progress-bar');
const progressWrap = document.getElementById('progress-bar-wrapper');

/* --- Progress Bar ------------------------------------------ */
function updateProgress() {
  if (state.showLeadForm || state.confirmed) {
    progressWrap.style.display = 'none';
    return;
  }
  progressWrap.style.display = '';
  if (state.step >= 7) {
    progressBar.style.width = '100%';
  } else {
    progressBar.style.width = ((state.step / 6) * 100) + '%';
  }
}

/* --- Transition helper ------------------------------------- */
function transition(renderFn) {
  appEl.classList.remove('fade-in');
  appEl.classList.add('fade-out');
  setTimeout(() => {
    appEl.classList.remove('fade-out');
    renderFn();
    appEl.classList.add('fade-in');
    updateProgress();
  }, 150);
}

/* --- Back button HTML -------------------------------------- */
function backBtnHtml(step) {
  if (step <= 1) return '';
  return '<button class="back-btn" id="back-btn">Back</button>';
}

/* --- Render dispatcher ------------------------------------- */
function render() {
  updateProgress();

  if (state.confirmed) {
    renderConfirmation();
    return;
  }
  if (state.showLeadForm) {
    renderLeadForm();
    return;
  }

  switch (state.step) {
    case 1: renderStep1(); break;
    case 2: renderStep2(); break;
    case 3: renderStep3(); break;
    case 4: renderStep4(); break;
    case 5: renderStep5(); break;
    case 6: renderStep6(); break;
    case 7: renderStep7(); break;
    default: renderStep1();
  }
}

/* ============================================================
   STEP RENDERERS
   ============================================================ */

/* --- Step 1: Category -------------------------------------- */
function renderStep1() {
  const categories = [
    { id: "smartphones",   label: "Smartphones",      icon: "📱", active: true },
    { id: "tablets",       label: "Tablets",          icon: "📋", active: false },
    { id: "smartwatches",  label: "Smartwatches",     icon: "⌚", active: false },
    { id: "laptops",       label: "Laptops / MacBooks", icon: "💻", active: false },
    { id: "consoles",      label: "Game Consoles",    icon: "🎮", active: false },
  ];

  const cardsHtml = categories.map(cat => {
    const disabledAttr = cat.active ? '' : 'disabled';
    const disabledClass = cat.active ? '' : ' disabled';
    const badge = cat.active ? '' : '<span class="coming-soon-badge">Soon</span>';
    return `
      <button class="option-card${disabledClass}" data-category="${esc(cat.id)}" ${disabledAttr} aria-label="${esc(cat.label)}">
        ${badge}
        <span class="card-icon">${cat.icon}</span>
        <span class="card-label">${esc(cat.label)}</span>
      </button>`;
  }).join('');

  appEl.innerHTML = `
    <div class="step-header">
      <h1>What are you selling?</h1>
      <p>Select your device category to get started.</p>
    </div>
    <div class="option-grid">${cardsHtml}</div>
  `;

  appEl.querySelectorAll('.option-card:not(.disabled)').forEach(btn => {
    btn.addEventListener('click', () => {
      state.category = btn.dataset.category;
      state.step = 2;
      transition(render);
    });
  });
}

/* --- Step 2: Brand ----------------------------------------- */
function renderStep2() {
  const cardsHtml = Object.entries(DEVICE_DATA).map(([key, brand]) => `
    <button class="option-card" data-brand="${esc(key)}" aria-label="${esc(brand.label)}">
      <span class="card-icon">${brand.icon}</span>
      <span class="card-label">${esc(brand.label)}</span>
    </button>`
  ).join('');

  appEl.innerHTML = `
    ${backBtnHtml(2)}
    <div class="step-header">
      <h1>Select a brand</h1>
      <p>Which manufacturer made your device?</p>
    </div>
    <div class="option-grid">${cardsHtml}</div>
  `;

  bindBack();
  appEl.querySelectorAll('.option-card').forEach(btn => {
    btn.addEventListener('click', () => {
      state.brand = btn.dataset.brand;
      state.model = null;
      state.storage = null;
      state.step = 3;
      transition(render);
    });
  });
}

/* --- Step 3: Model ----------------------------------------- */
function renderStep3() {
  const brandData = DEVICE_DATA[state.brand];
  if (!brandData) { state.step = 2; render(); return; }

  const cardsHtml = Object.entries(brandData.models).map(([key, model]) => `
    <button class="option-card" data-model="${esc(key)}" aria-label="${esc(model.label)}">
      <span class="card-label">${esc(model.label)}</span>
    </button>`
  ).join('');

  appEl.innerHTML = `
    ${backBtnHtml(3)}
    <div class="step-header">
      <h1>Select your model</h1>
      <p>${esc(brandData.label)} — choose your exact device.</p>
    </div>
    <div class="option-grid">${cardsHtml}</div>
  `;

  bindBack();
  appEl.querySelectorAll('.option-card').forEach(btn => {
    btn.addEventListener('click', () => {
      state.model = btn.dataset.model;
      state.storage = null;
      state.step = 4;
      transition(render);
    });
  });
}

/* --- Step 4: Storage --------------------------------------- */
function renderStep4() {
  const brandData = DEVICE_DATA[state.brand];
  const modelData = brandData && brandData.models[state.model];
  if (!modelData) { state.step = 3; render(); return; }

  const pillsHtml = modelData.storage.map(s => `
    <button class="option-pill" data-storage="${esc(s)}">${esc(s)}</button>`
  ).join('');

  appEl.innerHTML = `
    ${backBtnHtml(4)}
    <div class="step-header">
      <h1>Storage capacity</h1>
      <p>How much storage does your ${esc(modelData.label)} have?</p>
    </div>
    <div class="pill-group">${pillsHtml}</div>
  `;

  bindBack();
  appEl.querySelectorAll('.option-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      state.storage = btn.dataset.storage;
      state.step = 5;
      transition(render);
    });
  });
}

/* --- Step 5: Carrier --------------------------------------- */
function renderStep5() {
  const pillsHtml = CARRIERS.map(c => `
    <button class="option-pill" data-carrier="${esc(c.value)}">${esc(c.label)}</button>`
  ).join('');

  appEl.innerHTML = `
    ${backBtnHtml(5)}
    <div class="step-header">
      <h1>Carrier / Network</h1>
      <p>Is your device unlocked or locked to a carrier?</p>
    </div>
    <div class="pill-group">${pillsHtml}</div>
  `;

  bindBack();
  appEl.querySelectorAll('.option-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      state.carrier = btn.dataset.carrier;
      state.step = 6;
      transition(render);
    });
  });
}

/* --- Step 6: Condition ------------------------------------- */
function renderStep6() {
  const cardsHtml = CONDITIONS.map(c => `
    <button class="condition-card" data-condition="${esc(c.value)}">
      <div class="cond-label">${esc(c.label)}</div>
      <div class="cond-desc">${esc(c.desc)}</div>
    </button>`
  ).join('');

  appEl.innerHTML = `
    ${backBtnHtml(6)}
    <div class="step-header">
      <h1>Device condition</h1>
      <p>Be honest — it helps us give you the most accurate quote.</p>
    </div>
    <div class="condition-grid">${cardsHtml}</div>
  `;

  bindBack();
  appEl.querySelectorAll('.condition-card').forEach(btn => {
    btn.addEventListener('click', () => {
      state.condition = btn.dataset.condition;
      state.step = 7;
      transition(render);
    });
  });
}

/* --- Step 7: Quote (loading → result) ---------------------- */
function renderStep7() {
  // Show spinner
  appEl.innerHTML = `
    <div class="loading-overlay">
      <div class="spinner"></div>
      <p>Fetching the best market prices for your device…</p>
    </div>
  `;
  updateProgress();
  fetchQuote();
}

async function fetchQuote() {
  const payload = {
    category:  state.category,
    brand:     state.brand,
    model:     state.model,
    storage:   state.storage.toLowerCase().replace(/\s+/g, ''),
    carrier:   state.carrier,
    condition: state.condition,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${API_BASE}/api/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || data.message || 'Quote unavailable');
    }

    state.quote = data;
    renderQuoteResult();
  } catch (err) {
    clearTimeout(timeoutId);
    const msg = err.name === 'AbortError'
      ? 'Request timed out. Please check your connection and try again.'
      : (err.message || 'Something went wrong. Please try again.');
    renderQuoteError(msg);
  }
}

function deviceSummaryLabel() {
  const brandData  = DEVICE_DATA[state.brand];
  const modelData  = brandData && brandData.models[state.model];
  const modelLabel = modelData ? modelData.label : state.model;
  const carrierLabel = (CARRIERS.find(c => c.value === state.carrier) || {}).label || state.carrier;
  const condLabel  = (CONDITIONS.find(c => c.value === state.condition) || {}).label || state.condition;
  return `${modelLabel} · ${state.storage} · ${carrierLabel} · ${condLabel}`;
}

function renderQuoteResult() {
  const q = state.quote;
  const price = Number(q.our_quote).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const summary = deviceSummaryLabel();

  appEl.innerHTML = `
    <div class="quote-card">
      <div class="quote-device-summary">${esc(summary)}</div>
      <div class="price-display"><sup>$</sup>${esc(price)}</div>
      <div class="quote-validity">This quote is valid for 24 hours</div>
      <div class="quote-actions">
        <button class="btn-primary btn-full" id="accept-btn">Accept &amp; Ship Your Device</button>
        <button class="btn-secondary btn-full" id="new-quote-btn">Get a New Quote</button>
      </div>
    </div>
  `;

  document.getElementById('accept-btn').addEventListener('click', () => {
    state.showLeadForm = true;
    transition(render);
  });

  document.getElementById('new-quote-btn').addEventListener('click', () => {
    resetState();
    transition(render);
  });
}

function renderQuoteError(msg) {
  appEl.innerHTML = `
    <div class="error-card">
      <div class="error-icon">⚠️</div>
      <h2>Unable to get a quote</h2>
      <p>${esc(msg)}</p>
      <button class="btn-primary" id="retry-btn">Try Again</button>
    </div>
  `;
  document.getElementById('retry-btn').addEventListener('click', () => {
    transition(renderStep7);
  });
}

/* --- Lead Capture Form ------------------------------------- */
function renderLeadForm() {
  const stateOptions = US_STATES.map(([code, name]) =>
    `<option value="${esc(code)}">${esc(name)}</option>`
  ).join('');

  const paymentMethods = [
    { value: 'zelle',  label: 'Zelle' },
    { value: 'paypal', label: 'PayPal' },
    { value: 'check',  label: 'Check' },
    { value: 'venmo',  label: 'Venmo' },
  ];
  const paymentRadios = paymentMethods.map(m => `
    <label>
      <input type="radio" name="payment_method" value="${esc(m.value)}" required>
      ${esc(m.label)}
    </label>`
  ).join('');

  appEl.innerHTML = `
    <div class="lead-form-wrapper">
      <h2>Almost there!</h2>
      <p class="form-subtitle">We'll send a prepaid shipping label to your email within 24 hours.</p>
      <div class="form-inline-error" id="form-error"></div>
      <form class="lead-form" id="lead-form" novalidate>
        <div class="form-group">
          <label for="f-name">Full Name</label>
          <input id="f-name" name="full_name" type="text" placeholder="Jane Smith" autocomplete="name" required />
        </div>
        <div class="form-row cols-2">
          <div class="form-group">
            <label for="f-email">Email Address</label>
            <input id="f-email" name="email" type="email" placeholder="jane@example.com" autocomplete="email" required />
          </div>
          <div class="form-group">
            <label for="f-phone">Phone Number</label>
            <input id="f-phone" name="phone" type="tel" placeholder="(555) 000-0000" autocomplete="tel" required />
          </div>
        </div>
        <div class="form-group">
          <label for="f-address">Street Address</label>
          <input id="f-address" name="address" type="text" placeholder="123 Main St" autocomplete="street-address" required />
        </div>
        <div class="form-row cols-2">
          <div class="form-group">
            <label for="f-city">City</label>
            <input id="f-city" name="city" type="text" placeholder="Springfield" autocomplete="address-level2" required />
          </div>
          <div class="form-group">
            <label for="f-state">State</label>
            <select id="f-state" name="state" autocomplete="address-level1" required>
              <option value="">— Select —</option>
              ${stateOptions}
            </select>
          </div>
        </div>
        <div class="form-group" style="max-width:180px">
          <label for="f-zip">ZIP Code</label>
          <input id="f-zip" name="zip" type="text" placeholder="12345" pattern="[0-9]{5}" inputmode="numeric" maxlength="5" autocomplete="postal-code" required />
        </div>
        <div>
          <span class="radio-group-label">Preferred Payment</span>
          <div class="radio-options">${paymentRadios}</div>
        </div>
        <div class="form-group">
          <label for="f-payment-details">Payment Details</label>
          <input id="f-payment-details" name="payment_details" type="text" placeholder="e.g. PayPal email or Zelle phone number" required />
        </div>
        <div class="form-submit-area">
          <button type="submit" class="btn-primary btn-full" id="submit-btn">Submit &amp; Get Shipping Label</button>
        </div>
      </form>
    </div>
  `;

  document.getElementById('lead-form').addEventListener('submit', handleLeadSubmit);
}

async function handleLeadSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const errorBox = document.getElementById('form-error');
  errorBox.classList.remove('visible');

  // --- Client-side validation ---
  const fields = form.querySelectorAll('input[required], select[required]');
  let firstInvalid = null;
  fields.forEach(f => {
    f.classList.remove('invalid');
    if (!f.value.trim() || !f.checkValidity()) {
      f.classList.add('invalid');
      if (!firstInvalid) firstInvalid = f;
    }
  });

  // radio group check
  const paymentChecked = form.querySelector('input[name="payment_method"]:checked');
  if (!paymentChecked) {
    errorBox.textContent = 'Please select a preferred payment method.';
    errorBox.classList.add('visible');
    return;
  }

  if (firstInvalid) {
    errorBox.textContent = 'Please fill in all required fields correctly.';
    errorBox.classList.add('visible');
    firstInvalid.focus();
    return;
  }

  // --- Collect form data and map to API schema field names ---
  const formData = new FormData(form);
  const raw = {};
  formData.forEach((val, key) => { raw[key] = val; });

  const body = {
    name:           raw.full_name,
    email:          raw.email,
    phone:          raw.phone,
    address:        raw.address,
    city:           raw.city,
    state:          raw.state,
    zip:            raw.zip,
    paymentMethod:  raw.payment_method,
    paymentDetails: raw.payment_details,
    quote: state.quote ? {
      our_quote:  state.quote.our_quote,
      device:     state.quote.device || deviceSummaryLabel(),
      carrier:    state.quote.carrier,
      condition:  state.quote.condition,
      quoted_at:  state.quote.quoted_at,
    } : undefined,
  };

  // Disable button during submit
  const submitBtn = document.getElementById('submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting…';

  const leadController = new AbortController();
  const leadTimeoutId = setTimeout(() => leadController.abort(), 15000);

  try {
    const res = await fetch(`${API_BASE}/api/lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: leadController.signal,
    });
    clearTimeout(leadTimeoutId);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || data.message || `Server error (${res.status})`);
    }

    state.confirmed = true;
    state.confirmedEmail = body.email;
    transition(renderConfirmation);
  } catch (err) {
    clearTimeout(leadTimeoutId);
    const msg = err.name === 'AbortError'
      ? 'Request timed out. Please check your connection and try again.'
      : (err.message || 'Something went wrong. Please try again.');
    errorBox.textContent = msg;
    errorBox.classList.add('visible');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit & Get Shipping Label';
    errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

/* --- Confirmation Screen ----------------------------------- */
function renderConfirmation() {
  const email = state.confirmedEmail || 'your inbox';
  appEl.innerHTML = `
    <div class="confirmation-card">
      <div class="confirmation-icon">✅</div>
      <h2>You're all set!</h2>
      <p>
        We'll email you a prepaid shipping label within 24 hours.<br>
        Check your inbox at <strong>${esc(email)}</strong>.
      </p>
      <button class="btn-secondary" id="start-over-btn">Get Another Quote</button>
    </div>
  `;

  document.getElementById('start-over-btn').addEventListener('click', () => {
    resetState();
    transition(render);
  });
}

/* --- State reset ------------------------------------------- */
function resetState() {
  state.step         = 1;
  state.category     = null;
  state.brand        = null;
  state.model        = null;
  state.storage      = null;
  state.carrier      = null;
  state.condition    = null;
  state.quote        = null;
  state.showLeadForm = false;
  state.confirmed    = false;
  state.confirmedEmail = null;
}

/* --- Back button binding ----------------------------------- */
function bindBack() {
  const btn = document.getElementById('back-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    goBack();
  });
}

function goBack() {
  if (state.step > 1) {
    state.step--;
    // Reset downstream state when going back
    if (state.step < 7) state.quote = null;
    if (state.step < 6) state.condition = null;
    if (state.step < 5) state.carrier = null;
    if (state.step < 4) state.storage = null;
    if (state.step < 3) state.model = null;
    if (state.step < 2) state.brand = null;
    transition(render);
  }
}

/* --- Keyboard navigation ----------------------------------- */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && state.step > 1 && !state.showLeadForm && !state.confirmed) {
    goBack();
  }
});

/* --- Boot -------------------------------------------------- */
render();
