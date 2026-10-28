# What to wear today

A standalone React + TypeScript frontend for `fe-brief.md`. Enter a location to get an outfit, extra layers or protection, and the daily forecast behind the advice. The app uses the existing backend by default; an explicit demo mode works without a backend or internet connection after dependencies are installed.

## Run with the live backend

Requires Node.js 22.16 or newer and npm. From the parent `stream/` directory, start the backend in one terminal:

```sh
cd backend
npm ci
npm run dev
```

In another terminal, from `stream/`:

```sh
cd frontend
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. Enter **London**, optionally enter **GB** in Country, and select **Find my outfit**. The resolved place, local forecast date, clothing advice, and weather should appear. The backend requires network access to Open-Meteo.

The frontend dev server proxies `/api` to `http://127.0.0.1:3000`, so no CORS changes are needed. If the backend runs on another address, update the `server.proxy` and `preview.proxy` targets in `vite.config.ts`. The frontend port is strict: stop an existing server or pass `-- --port 5174` if 5173 is occupied. Stop servers with Ctrl-C.

## Demo without a backend

From `frontend/`:

```sh
npm ci
npm run dev:demo
```

Open **http://127.0.0.1:5173**. A sample-weather banner identifies demo mode. Stop a live frontend instance before starting the demo on the same port.

| Location input         | Expected behaviour                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `London`               | Loading for about 800ms, then a jacket/jumper outfit, waterproof extras, and London sample weather.                 |
| `Slow`                 | Loading for about 2.5 seconds, then the same sample. Select **Cancel search** to cancel and enter another location. |
| `Nowhere`              | An unknown-location message. Enter `London` and submit to recover.                                                  |
| `Offline`              | A request-failure message. Enter `London` and submit to recover.                                                    |
| Blank or one character | Inline validation; no request is made.                                                                              |

Demo names are case-insensitive. Other names return unknown-location feedback. The demo ignores Country and always returns the fixed London sample dated **28 October 2026** on success. It does not claim to provide current weather. There is no automatic fallback to sample data when the live backend fails.

To exercise real failures in live mode, try an unrecognised name such as `zzzzzznonexistentplacezzzzzz`, or stop the backend and submit again. Restart it and resubmit to recover. The previous result is cleared when a new request starts, so a failed search cannot leave another place’s outfit looking current.

## Checks

Run from `frontend/`:

```sh
npm run check
```

This runs TypeScript checking, 40 API/interface tests, ESLint, Prettier checking, and a production build. Tests are included because the implementation request explicitly asked for them, although the exercise brief excludes them from its baseline scope.

For browser checks:

```sh
npx playwright install chromium
npm run test:e2e
```

Playwright starts and stops its own frontend on port **5175**. That port must be free. Browser tests run on desktop and a mobile viewport in Chromium. They intercept API responses to make success, loading, unknown-location, server failure, and network failure repeatable; they do not depend on Open-Meteo. They also check keyboard submission, result focus, and narrow-screen forecast layout. Mobile emulation is not a real iPhone/Safari test.

Individual checks are `npm run typecheck`, `npm test`, `npm run lint`, `npm run format:check`, and `npm run build`. Use `npm run format` to apply formatting. `npm run test:watch` reruns unit/interface tests while editing. Browser failures retain screenshots and traces under `test-results/`.

## Build and preview

```sh
npm run build
npm run preview
```

Open **http://127.0.0.1:4173**. The live build still needs the backend on port 3000; the preview server supplies the same API proxy. To preview a standalone demo build instead:

```sh
npm run build:demo
npm run preview
```

Both build commands replace `dist/`. For deployment, serve `dist/` and route `/api` to a backend on the same origin. The development/preview proxy is not embedded in the static bundle. Hosting and deployment are outside this exercise.

## API contract

API access is isolated in `src/api.ts`; display components receive an `AdviceClient` function. The live adapter uses the existing backend contract:

```http
GET /api/advice?location=London&countryCode=GB
Accept: application/json
```

`location` is required, trimmed, and 2–100 characters. `countryCode` is optional; when supplied it must be two letters and is normalised to uppercase. Query parameters are URL-encoded. Ambiguous places use the backend’s first match. Country helps narrow the search but does not resolve ambiguity within a country.

A representative `200` response:

```json
{
  "location": {
    "name": "London",
    "region": "England",
    "country": "United Kingdom",
    "countryCode": "GB",
    "latitude": 51.50853,
    "longitude": -0.12574,
    "timezone": "Europe/London"
  },
  "date": "2026-10-28",
  "weather": {
    "feelsLike": { "min": 8, "max": 14, "unit": "°C" },
    "precipitationProbability": { "max": 80, "unit": "%" },
    "precipitation": { "total": 4.2, "unit": "mm" },
    "windSpeed": { "max": 24, "unit": "km/h" },
    "uvIndex": { "max": 2, "unit": "index" }
  },
  "recommendations": [
    {
      "item": "Jacket, jumper and trousers",
      "reason": "Today's feels-like high is 14°C."
    },
    {
      "item": "Waterproof outer layer and water-resistant shoes",
      "reason": "Precipitation chance peaks at 80%, with 4.2 mm forecast."
    }
  ],
  "source": { "name": "Open-Meteo", "url": "https://open-meteo.com/" }
}
```

`region`, `country`, and `countryCode` may be `null`. Recommendations must contain at least one item; the first is the base outfit, matching the existing backend’s ordering. Remaining items are displayed as extras, with the API’s reasons unchanged. Zod validates response fields, units, numeric ranges, date syntax, and an HTTP(S) attribution URL before display. The frontend does not calculate weather or clothing recommendations.

Errors use `{ "error": { "code": "LOCATION_NOT_FOUND", "message": "..." } }`. The adapter distinguishes `404 LOCATION_NOT_FOUND`, `400 INVALID_INPUT`, and timeouts (`504` or `UPSTREAM_TIMEOUT`). Other statuses, invalid payloads, and network failures produce recoverable request errors. It uses client-owned messages and a 15-second deadline covering the response body. Cancel/unmount abort requests; stale results cannot replace a newer search.

## Presentation and limits

The main card answers “what should I put on?” first. Extra recommendations follow as a checklist; supporting weather uses feels-like temperatures, precipitation, wind, and UV. The selected place, region/country, forecast date, and timezone make the backend’s resolution visible. The date is formatted without converting the location’s calendar day into the browser’s timezone.

The full-day forecast includes overnight conditions, even when requested late in the day. Advice is general and does not account for personal temperature preferences, activity, or hourly plans. This scope excludes persistence, location autocomplete, geolocation, saved outfits, unit switching, and multi-location selection.

Inputs have visible labels, validation moves focus to the invalid field, loading is announced through a status region, errors use alerts, and successful results receive keyboard focus. The layout adapts to narrow screens and respects reduced-motion preferences. Screen-reader hardware, Safari, and Firefox have not been tested.

## Files

- `src/App.tsx`: form, request state, outfit and forecast display.
- `src/api.ts`: live request adapter, runtime schema, errors and timeout.
- `src/demo.ts`: deterministic sample responses with abortable delays.
- `src/styles.css`: responsive styles without remote fonts or image dependencies.
- `src/*.test.*`: API boundary and interface tests.
- `e2e/advice.spec.ts`: browser workflows using controlled HTTP responses.

This directory has its own dependencies, lockfile, and configuration within the shared `stream` repository. It can be moved independently of the backend; only live mode needs an API server matching the documented contract.
