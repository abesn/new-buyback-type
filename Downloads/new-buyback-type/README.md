# Buyback Quote App

A device buyback quoting web app. Prospects select their device specs to get an instant offer price.

## Architecture

- **Frontend** — Static HTML/CSS/JS (`frontend/`), deployed as a DigitalOcean Static Site
- **Backend** — Node.js Express API (`backend/`), deployed as a DigitalOcean Web Service via Docker

## Local Development

### Prerequisites
- Node.js 18+
- npm

### Backend setup
```bash
cd backend
npm install
npx playwright install chromium
cp .env.example .env
# Edit .env and add your RESEND_API_KEY
node server.js
```

Backend runs at http://localhost:3001

### Frontend setup
```bash
# Serve frontend/ with any static file server
npx serve frontend
```

Frontend runs at http://localhost:3000

### Test the API
```bash
curl -X POST http://localhost:3001/api/quote \
  -H "Content-Type: application/json" \
  -d '{"category":"smartphones","brand":"apple","model":"iphone-15-pro-max","storage":"256gb","carrier":"unlocked","condition":"good"}'
```

## Deployment (DigitalOcean App Platform)

### Prerequisites

- A [DigitalOcean](https://cloud.digitalocean.com/) account
- [`doctl`](https://docs.digitalocean.com/reference/doctl/how-to/install/) CLI installed and authenticated (`doctl auth init`)
- A [Resend](https://resend.com/) API key for email notifications

### Step 1 — Fork/clone the repo

```bash
git clone <your-repo-url>
cd new-buyback-type
```

### Step 2 — Create the app

```bash
doctl app create --spec .do/app.yaml
```

The `RESEND_API_KEY` is defined as a SECRET in `app.yaml` with an empty value — you must set it before the backend will start correctly (see Step 3).

### Step 3 — Set your Resend API key

After `doctl app create` returns the app ID, set the secret:

```bash
# Replace <app-id> with the ID printed by the previous command
doctl app update <app-id> --spec .do/app.yaml
```

Or set it directly in the [DO App Platform console](https://cloud.digitalocean.com/apps):
1. Open your app → **Settings** → **Components** → **api**
2. Under **Environment Variables**, set `RESEND_API_KEY` to your Resend key and mark it as **Encrypted**.

### Step 4 — Get the backend service URL

Once the first deploy completes, open the DO console → your app → **api** component and copy its **Live URL** (looks like `https://api-xxxxx.ondigitalocean.app`).

### Step 5 — Wire the frontend to the backend

Because the frontend is plain static HTML with no build step, DigitalOcean cannot inject environment variables into it at runtime. You must update the `API_BASE` fallback in `frontend/js/app.js`:

Open `frontend/js/app.js` and change line 9 from:

```js
const API_BASE = window.API_BASE || 'http://localhost:3001';
```

to:

```js
const API_BASE = window.API_BASE || 'https://<your-api-live-url>';
```

Replace `<your-api-live-url>` with the URL copied in Step 4.

### Step 6 — Redeploy

Commit and push the change. DigitalOcean will automatically redeploy the frontend:

```bash
git add frontend/js/app.js
git commit -m "chore: set deployed API_BASE URL"
git push
```

### Step 7 — Verify FRONTEND_ORIGIN

The `FRONTEND_ORIGIN` env var on the backend is set to `${frontend.LIVE_URL}` in `app.yaml`, so DO will inject the correct static-site URL automatically. You can verify it in the console under the **api** component's environment variables after deploy.

### Updating the app spec

To push config changes (env vars, instance size, etc.) without redeploying from scratch:

```bash
doctl app update <app-id> --spec .do/app.yaml
```

## Environment Variables

See `backend/.env.example` for all required variables and their descriptions.
