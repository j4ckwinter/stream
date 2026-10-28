# Stream — What to Wear Today

A TypeScript application that turns a location into weather-based clothing advice. The React frontend calls a Fastify backend, which resolves the location and retrieves today's local forecast from Open-Meteo.

## Run locally

Requires Node.js 22.16 or newer and npm. From the repository root, start the backend:

```sh
cd backend
npm ci
npm run dev
```

In another terminal, start the frontend from the repository root:

```sh
cd frontend
npm ci
npm run dev
```

Open http://127.0.0.1:5173 and search for London with country code GB. The frontend proxies API requests to the backend on port 3000. The backend needs internet access to call Open-Meteo.

For an offline demo after installing dependencies, run `npm run dev:demo` in `frontend/` and search for London. Demo mode displays clearly labelled sample weather.

## Verify

From the repository root:

```sh
npm --prefix backend run check
npm --prefix frontend run check
cd frontend
npx playwright install chromium
npm run test:e2e
```

Each app's `check` command runs type checking, automated tests, linting, formatting checks, and a production build. Browser tests cover desktop and mobile layouts with controlled API responses.

## Project

- [Frontend instructions and API integration](frontend/README.md)
- [Backend instructions and recommendation rules](backend/README.md)
- [Exercise overview](brief.md), [frontend brief](fe-brief.md), and [backend brief](be-brief.md)

Both apps have their own dependencies and lockfiles within this repository. There is no database or authentication. Location selection uses the first geocoding match; advice covers the full local calendar day. Hosting and deployment are not configured.
