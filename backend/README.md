# What to Wear Today API

A standalone TypeScript backend for [the backend brief](../be-brief.md). It resolves a place with Open-Meteo, fetches today's forecast, and returns clothing suggestions with reasons. No database, API key, frontend, or generated-text service is needed for the demo. Tests are included as requested in the implementation task.

## Run locally

Requires Node.js 22.16 or newer and npm. Run these commands from this directory:

```sh
npm ci
npm run dev
```

The server listens on `http://127.0.0.1:3000`. `PORT` and `HOST` override the defaults. For a compiled run:

```sh
npm run build
npm start
```

Stop with Ctrl-C. Development mode reloads on source changes. The runtime needs outbound HTTPS access to `geocoding-api.open-meteo.com` and `api.open-meteo.com`.

## Exercise the API

```sh
curl -i http://127.0.0.1:3000/health
curl -i --get http://127.0.0.1:3000/api/advice \
  --data-urlencode 'location=London' --data-urlencode 'countryCode=GB'
curl -i http://127.0.0.1:3000/api/advice
curl -i --get http://127.0.0.1:3000/api/advice \
  --data-urlencode 'location=zzzzzznonexistentplacezzzzzz'
```

Expect `200` for health and London, `400` for missing input, and `404` for the unknown location. `/health` only checks that the process responds; it does not call Open-Meteo.

### `GET /api/advice`

| Query parameter | Requirement                                                                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `location`      | Required string, 2–100 characters after trimming. A city, town, or postal code supported by the geocoder.                                            |
| `countryCode`   | Optional two-letter country code, such as `GB` or `US`; normalised to uppercase. Syntax is validated; country matching is delegated to the geocoder. |

Repeated parameters and unknown parameters return `400`. Ambiguous names use the first geocoder result, rather than asking the client to choose. The response includes the selected region, country, and coordinates so the client can make that choice visible. Use `countryCode` to narrow the search; it does not disambiguate places within a country.

Illustrative response (weather values change):

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
    "feelsLike": { "min": 5.5, "max": 13.3, "unit": "°C" },
    "precipitationProbability": { "max": 0, "unit": "%" },
    "precipitation": { "total": 0, "unit": "mm" },
    "windSpeed": { "max": 16.6, "unit": "km/h" },
    "uvIndex": { "max": 1, "unit": "index" }
  },
  "recommendations": [
    {
      "item": "Jacket, jumper and trousers",
      "reason": "Today's feels-like high is 13.3°C."
    }
  ],
  "source": { "name": "Open-Meteo", "url": "https://open-meteo.com/" }
}
```

`region`, `country`, and `countryCode` are `null` if the geocoder omits them. Numeric forecast fields are required; missing or invalid forecast values produce an upstream error rather than misleading advice.

Errors have a consistent shape. HTTP parsing failures can occur before route matching (including for an unsupported method); these preserve the framework's 4xx status and use `INVALID_REQUEST`.

```json
{
  "error": {
    "code": "LOCATION_NOT_FOUND",
    "message": "No matching location was found. Try another name or country code."
  }
}
```

| HTTP status | Code                 | Meaning                                                        |
| ----------- | -------------------- | -------------------------------------------------------------- |
| 400         | `INVALID_INPUT`      | Invalid query parameters.                                      |
| 404         | `LOCATION_NOT_FOUND` | No geocoding match.                                            |
| 404         | `NOT_FOUND`          | Unknown route or unsupported method.                           |
| 502         | `UPSTREAM_ERROR`     | Upstream HTTP/network failure, invalid JSON, or unusable data. |
| 504         | `UPSTREAM_TIMEOUT`   | An upstream request exceeded five seconds.                     |
| 500         | `INTERNAL_ERROR`     | Unexpected application error; details stay in server logs.     |

## Recommendation choices

“Today” is the full calendar day at the resolved coordinates. The forecast request uses `timezone=auto` and `forecast_days=1`; the response preserves the provider's local date and timezone. It includes overnight conditions, even for a request made late in the day. This is whole-day clothing guidance, not an hourly or remaining-day forecast.

The rules use apparent (feels-like) temperature, rather than air temperature:

| Condition                                                | Advice                                              |
| -------------------------------------------------------- | --------------------------------------------------- |
| Daily high below 5°C                                     | Winter coat, warm layers, trousers, hat and gloves. |
| High from 5°C to below 15°C                              | Jacket, jumper and trousers.                        |
| High from 15°C to below 23°C                             | Light top, removable light layer and trousers.      |
| High at least 23°C                                       | Light, breathable clothing.                         |
| Low below 5°C with high at least 5°C                     | Add a warm coat for early/late outings.             |
| Otherwise, low below 15°C with high at least 15°C        | Add an extra jumper for early/late outings.         |
| Precipitation chance at least 40% or total at least 1 mm | Waterproof layer and water-resistant shoes.         |
| Maximum wind at least 30 km/h                            | Wind-resistant layer.                               |
| Maximum UV index at least 3                              | Sun hat and sunglasses.                             |

These are simple product heuristics, not personalised advice. One garment may satisfy several suggestions. Activity, personal temperature preference, snow/ice conditions, and severe-weather alerts are not modelled.

## Checks and layout

```sh
npm run check
```

This runs TypeScript checking, offline automated tests, ESLint, Prettier checking, and a production build. Individual commands are `npm run typecheck`, `npm test`, `npm run lint`, `npm run format:check`, and `npm run build`. Use `npm run format` to apply formatting.

- `src/app.ts`: HTTP routes, query validation, and JSON errors.
- `src/weather.ts`: Open-Meteo requests, runtime response validation, and conversion to the public weather shape.
- `src/recommendations.ts`: deterministic clothing rules.
- `src/server.ts`: startup configuration and shutdown.
- `test/`: recommendation and API tests using injected fetch responses; no live network dependency.

Fastify supplies HTTP handling and an in-process request test harness. Zod validates untrusted queries and provider JSON. TypeScript runs in strict mode. Tests exercise the real route and weather adapter with substituted network responses; use the curl examples separately to verify the live provider.

## Integration and limits

The two upstream requests run sequentially, each with a five-second deadline covering headers and response body. There are no retries, cache, persistence, authentication, or rate limiting. The free provider can be unavailable or rate limited; those failures return `502` or `504`. This demo does not configure CORS: a separately hosted frontend should use a development proxy or add an explicit allowed-origin policy before integration.

The backend folder is self-contained and can be moved into its own repository. No deployment is configured. Before public hosting, decide on traffic limits, caching, observability, and the provider plan appropriate to usage.

Provider references: [forecast API](https://open-meteo.com/en/docs) and [geocoding API](https://open-meteo.com/en/docs/geocoding-api). Display the returned Open-Meteo attribution in a consuming UI and review the provider's usage terms before deployment.
