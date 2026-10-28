import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../src/app.js";

const location = {
  name: "London",
  latitude: 51.50853,
  longitude: -0.12574,
  country: "United Kingdom",
  country_code: "GB",
  admin1: "England",
};

void test("malformed JSON preserves a client error without exposing parser details", async (t) => {
  const app = buildApp({
    fetch: () => assert.fail("No upstream access expected"),
  });
  t.after(() => app.close());
  const response = await app.inject({
    method: "POST",
    url: "/api/advice",
    headers: { "content-type": "application/json" },
    payload: "{",
  });
  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), {
    error: {
      code: "INVALID_REQUEST",
      message: "The HTTP request could not be processed.",
    },
  });
});

void test("deadline also aborts a stalled upstream response body", async (t) => {
  const app = buildApp({
    timeoutMs: 10,
    fetch: (_input, init) => {
      const signal = init?.signal;
      assert.ok(signal);
      return Promise.resolve(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('{"results":'));
              const fallback = setTimeout(
                () => controller.error(new Error("Abort was not received")),
                1000,
              );
              signal.addEventListener(
                "abort",
                () => {
                  clearTimeout(fallback);
                  controller.error(new DOMException("Aborted", "AbortError"));
                },
                { once: true },
              );
            },
          }),
        ),
      );
    },
  });
  t.after(() => app.close());
  const response = await app.inject("/api/advice?location=London");
  assert.equal(response.statusCode, 504);
  assert.equal(
    response.json<{ error: { code: string } }>().error.code,
    "UPSTREAM_TIMEOUT",
  );
});

function forecast() {
  return {
    timezone: "Europe/London",
    daily_units: {
      time: "iso8601",
      apparent_temperature_min: "°C",
      apparent_temperature_max: "°C",
      precipitation_probability_max: "%",
      precipitation_sum: "mm",
      wind_speed_10m_max: "km/h",
      uv_index_max: "",
    },
    daily: {
      time: ["2026-10-28"],
      apparent_temperature_min: [8],
      apparent_temperature_max: [18],
      precipitation_probability_max: [70],
      precipitation_sum: [2],
      wind_speed_10m_max: [35],
      uv_index_max: [4],
    },
  };
}

function responses(...values: unknown[]): typeof fetch {
  return () => {
    assert.ok(values.length > 0, "Unexpected upstream request");
    return Promise.resolve(Response.json(values.shift()));
  };
}

void test("returns resolved location, local date, weather units and explained advice", async (t) => {
  const app = buildApp({
    fetch: responses({ results: [location] }, forecast()),
  });
  t.after(() => app.close());
  const response = await app.inject("/api/advice?location=London");
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["cache-control"], "no-store");
  assert.deepEqual(response.json(), {
    location: {
      name: "London",
      region: "England",
      country: "United Kingdom",
      countryCode: "GB",
      latitude: 51.50853,
      longitude: -0.12574,
      timezone: "Europe/London",
    },
    date: "2026-10-28",
    weather: {
      feelsLike: { min: 8, max: 18, unit: "°C" },
      precipitationProbability: { max: 70, unit: "%" },
      precipitation: { total: 2, unit: "mm" },
      windSpeed: { max: 35, unit: "km/h" },
      uvIndex: { max: 4, unit: "index" },
    },
    recommendations: [
      {
        item: "Light top, light layer and trousers",
        reason:
          "Today's feels-like high is 18°C; a removable layer gives flexibility.",
      },
      {
        item: "Extra jumper for early or late outings",
        reason: "The full-day feels-like low is 8°C.",
      },
      {
        item: "Waterproof outer layer and water-resistant shoes",
        reason: "Precipitation chance peaks at 70%, with 2 mm forecast.",
      },
      {
        item: "Wind-resistant outer layer",
        reason: "Wind speeds may reach 35 km/h.",
      },
      {
        item: "Sun hat and sunglasses",
        reason: "The UV index may reach 4.",
      },
    ],
    source: { name: "Open-Meteo", url: "https://open-meteo.com/" },
  });
});

void test("normalizes input and requests one local day with explicit metric units", async (t) => {
  const urls: URL[] = [];
  const mock = responses({ results: [location] }, forecast());
  const app = buildApp({
    fetch: (input, init) => {
      assert.ok(input instanceof URL);
      urls.push(input);
      assert.ok(init?.signal instanceof AbortSignal);
      return mock(input, init);
    },
  });
  t.after(() => app.close());
  const response = await app.inject(
    "/api/advice?location=%20London%20&countryCode=gb",
  );
  assert.equal(response.statusCode, 200);
  assert.equal(urls.length, 2);
  assert.equal(urls[0]?.origin, "https://geocoding-api.open-meteo.com");
  assert.equal(urls[0]?.searchParams.get("name"), "London");
  assert.equal(urls[0]?.searchParams.get("count"), "1");
  assert.equal(urls[0]?.searchParams.get("countryCode"), "GB");
  assert.equal(urls[1]?.origin, "https://api.open-meteo.com");
  for (const [name, value] of Object.entries({
    latitude: "51.50853",
    longitude: "-0.12574",
    timezone: "auto",
    forecast_days: "1",
    temperature_unit: "celsius",
    precipitation_unit: "mm",
    wind_speed_unit: "kmh",
  })) {
    assert.equal(urls[1]?.searchParams.get(name), value);
  }
  assert.deepEqual(urls[1]?.searchParams.get("daily")?.split(",").sort(), [
    "apparent_temperature_max",
    "apparent_temperature_min",
    "precipitation_probability_max",
    "precipitation_sum",
    "uv_index_max",
    "wind_speed_10m_max",
  ]);
});

for (const query of [
  "",
  "location=",
  "location=%20%20",
  "location=A",
  `location=${"a".repeat(101)}`,
  "location=London&location=Paris",
  "location=London&countryCode=GB&countryCode=US",
  "location=London&countryCode=G",
  "location=London&countryCode=123",
  "location=London&countryCode=",
  "location=London&extra=value",
]) {
  void test(`rejects invalid query without upstream access: ${query || "missing"}`, async (t) => {
    const app = buildApp({
      fetch: () => assert.fail("Must validate before upstream access"),
    });
    t.after(() => app.close());
    const response = await app.inject(`/api/advice?${query}`);
    assert.equal(response.statusCode, 400);
    assert.equal(
      response.json<{ error: { code: string } }>().error.code,
      "INVALID_INPUT",
    );
  });
}

for (const empty of [{}, { results: [] }]) {
  void test(`unknown location gives 404 for ${JSON.stringify(empty)}`, async (t) => {
    const app = buildApp({ fetch: responses(empty) });
    t.after(() => app.close());
    const response = await app.inject("/api/advice?location=Nowhere");
    assert.equal(response.statusCode, 404);
    assert.equal(
      response.json<{ error: { code: string } }>().error.code,
      "LOCATION_NOT_FOUND",
    );
  });
}

void test("selects the first location and preserves the provider's date and timezone", async (t) => {
  const localForecast = forecast();
  localForecast.timezone = "Pacific/Auckland";
  localForecast.daily.time = ["2026-10-29"];
  const app = buildApp({
    fetch: responses(
      {
        results: [
          { name: "Wellington", latitude: -41.29, longitude: 174.78 },
          location,
        ],
      },
      localForecast,
    ),
  });
  t.after(() => app.close());
  const response = await app.inject("/api/advice?location=Wellington");
  assert.equal(response.statusCode, 200);
  const body = response.json<{ date: string; location: unknown }>();
  assert.equal(body.date, "2026-10-29");
  assert.deepEqual(body.location, {
    name: "Wellington",
    latitude: -41.29,
    longitude: 174.78,
    region: null,
    country: null,
    countryCode: null,
    timezone: "Pacific/Auckland",
  });
});

const invalidForecasts: [string, unknown][] = [
  ["missing forecast", {}],
  ["null forecast", null],
  [
    "null observation",
    {
      ...forecast(),
      daily: { ...forecast().daily, apparent_temperature_max: [null] },
    },
  ],
  [
    "empty daily array",
    { ...forecast(), daily: { ...forecast().daily, time: [] } },
  ],
  [
    "invalid date",
    { ...forecast(), daily: { ...forecast().daily, time: ["2026-02-30"] } },
  ],
  [
    "probability out of range",
    {
      ...forecast(),
      daily: { ...forecast().daily, precipitation_probability_max: [101] },
    },
  ],
  [
    "negative wind",
    { ...forecast(), daily: { ...forecast().daily, wind_speed_10m_max: [-1] } },
  ],
  [
    "inverted temperature range",
    {
      ...forecast(),
      daily: { ...forecast().daily, apparent_temperature_min: [20] },
    },
  ],
  [
    "wrong units",
    {
      ...forecast(),
      daily_units: {
        ...forecast().daily_units,
        apparent_temperature_max: "°F",
      },
    },
  ],
];
for (const [name, body] of invalidForecasts) {
  void test(`rejects unusable forecast: ${name}`, async (t) => {
    const app = buildApp({ fetch: responses({ results: [location] }, body) });
    t.after(() => app.close());
    const response = await app.inject("/api/advice?location=London");
    assert.equal(response.statusCode, 502);
    assert.equal(
      response.json<{ error: { code: string } }>().error.code,
      "UPSTREAM_ERROR",
    );
  });
}

for (const body of [
  null,
  { results: null },
  { results: [{ ...location, latitude: 91 }] },
]) {
  void test(`rejects malformed geocoding: ${JSON.stringify(body)}`, async (t) => {
    const app = buildApp({ fetch: responses(body) });
    t.after(() => app.close());
    const response = await app.inject("/api/advice?location=London");
    assert.equal(response.statusCode, 502);
    assert.equal(
      response.json<{ error: { code: string } }>().error.code,
      "UPSTREAM_ERROR",
    );
  });
}

for (const stage of ["geocoding", "forecast"]) {
  for (const kind of ["http", "network", "json"]) {
    void test(`handles ${stage} ${kind} failure without leaking upstream details`, async (t) => {
      let count = 0;
      const app = buildApp({
        fetch: () => {
          count++;
          if (stage === "forecast" && count === 1)
            return Promise.resolve(Response.json({ results: [location] }));
          if (kind === "network")
            return Promise.reject(new Error("private upstream detail"));
          if (kind === "http")
            return Promise.resolve(
              new Response("private upstream detail", { status: 429 }),
            );
          return Promise.resolve(new Response("private upstream detail"));
        },
      });
      t.after(() => app.close());
      const response = await app.inject("/api/advice?location=London");
      assert.equal(response.statusCode, 502);
      assert.equal(
        response.json<{ error: { code: string } }>().error.code,
        "UPSTREAM_ERROR",
      );
      assert.ok(!response.body.includes("private upstream detail"));
    });
  }
}

for (const stage of ["geocoding", "forecast"]) {
  void test(`aborts slow ${stage} requests and returns 504`, async (t) => {
    let count = 0;
    const app = buildApp({
      timeoutMs: 10,
      fetch: (_input, init) => {
        count++;
        if (stage === "forecast" && count === 1)
          return Promise.resolve(Response.json({ results: [location] }));
        return new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          assert.ok(signal);
          const fallback = setTimeout(
            () => reject(new Error("Abort was not received")),
            1000,
          );
          signal.addEventListener(
            "abort",
            () => {
              clearTimeout(fallback);
              reject(new DOMException("Aborted", "AbortError"));
            },
            { once: true },
          );
        });
      },
    });
    t.after(() => app.close());
    const response = await app.inject("/api/advice?location=London");
    assert.equal(response.statusCode, 504);
    assert.equal(
      response.json<{ error: { code: string } }>().error.code,
      "UPSTREAM_TIMEOUT",
    );
  });
}

void test("health and unknown routes do not call weather services", async (t) => {
  const app = buildApp({
    fetch: () => assert.fail("No upstream request expected"),
  });
  t.after(() => app.close());
  const health = await app.inject("/health");
  assert.equal(health.statusCode, 200);
  assert.deepEqual(health.json(), { status: "ok" });
  const missing = await app.inject("/missing");
  assert.equal(missing.statusCode, 404);
  assert.deepEqual(missing.json(), {
    error: { code: "NOT_FOUND", message: "This endpoint does not exist." },
  });
});
