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

## Deployment (DigitalOcean)

See `.do/app.yaml` — deploy via the DigitalOcean App Platform console or CLI (`doctl app create --spec .do/app.yaml`).

## Environment Variables

See `backend/.env.example` for all required variables.
