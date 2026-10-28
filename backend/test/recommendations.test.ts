import assert from "node:assert/strict";
import { test } from "node:test";
import { recommend } from "../src/recommendations.js";
import type { Weather } from "../src/weather.js";

function weather(overrides: Partial<Weather> = {}): Weather {
  return {
    feelsLike: { min: 15, max: 20, unit: "°C" },
    precipitationProbability: { max: 0, unit: "%" },
    precipitation: { total: 0, unit: "mm" },
    windSpeed: { max: 0, unit: "km/h" },
    uvIndex: { max: 0, unit: "index" },
    ...overrides,
  };
}

for (const [max, expected] of [
  [-5, "Winter coat, warm layers, trousers, hat and gloves"],
  [4.9, "Winter coat, warm layers, trousers, hat and gloves"],
  [5, "Jacket, jumper and trousers"],
  [14.9, "Jacket, jumper and trousers"],
  [15, "Light top, light layer and trousers"],
  [22.9, "Light top, light layer and trousers"],
  [23, "Light, breathable clothing"],
  [35, "Light, breathable clothing"],
] as const) {
  void test(`suggests appropriate base clothing at feels-like high ${max}°C`, () => {
    const advice = recommend(
      weather({ feelsLike: { min: max, max, unit: "°C" } }),
    );
    assert.equal(advice.length, 1);
    assert.equal(advice[0]?.item, expected);
    assert.ok(advice[0]?.reason.includes(`${max}°C`));
  });
}

void test("accounts for a cold morning even on a warm day", () => {
  const advice = recommend(
    weather({ feelsLike: { min: -2, max: 25, unit: "°C" } }),
  );
  assert.deepEqual(
    advice.map(({ item }) => item),
    ["Light, breathable clothing", "Warm coat for early or late outings"],
  );
  assert.ok(advice[1]?.reason.includes("-2°C"));
});

void test("adds a removable jumper for a cool morning", () => {
  const advice = recommend(
    weather({ feelsLike: { min: 5, max: 23, unit: "°C" } }),
  );
  assert.deepEqual(
    advice.map(({ item }) => item),
    ["Light, breathable clothing", "Extra jumper for early or late outings"],
  );
});

void test("keeps advice minimal below precipitation, wind and UV thresholds", () => {
  const advice = recommend(
    weather({
      precipitationProbability: { max: 39, unit: "%" },
      precipitation: { total: 0.9, unit: "mm" },
      windSpeed: { max: 29.9, unit: "km/h" },
      uvIndex: { max: 2.9, unit: "index" },
    }),
  );
  assert.equal(advice.length, 1);
});

for (const rain of [
  { precipitationProbability: { max: 40, unit: "%" as const } },
  { precipitation: { total: 1, unit: "mm" as const } },
]) {
  void test(`suggests waterproof clothing when ${JSON.stringify(rain)}`, () => {
    const advice = recommend(weather(rain));
    assert.deepEqual(
      advice.map(({ item }) => item),
      [
        "Light top, light layer and trousers",
        "Waterproof outer layer and water-resistant shoes",
      ],
    );
  });
}

void test("combines wind and sun protection at their thresholds", () => {
  const advice = recommend(
    weather({
      windSpeed: { max: 30, unit: "km/h" },
      uvIndex: { max: 3, unit: "index" },
    }),
  );
  assert.deepEqual(
    advice.map(({ item }) => item),
    [
      "Light top, light layer and trousers",
      "Wind-resistant outer layer",
      "Sun hat and sunglasses",
    ],
  );
  assert.ok(advice[1]?.reason.includes("30 km/h"));
  assert.ok(advice[2]?.reason.includes("3"));
});
