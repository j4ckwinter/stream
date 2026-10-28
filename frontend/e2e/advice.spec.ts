import { expect, test } from "@playwright/test";
import { demoAdvice } from "../src/demo";

test("shows loading, resolved advice and attribution without horizontal overflow", async ({
  page,
}) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/advice?**", async (route) => {
    expect(new URL(route.request().url()).searchParams.get("location")).toBe(
      "London",
    );
    await gate;
    await route.fulfill({ json: demoAdvice });
  });
  await page.goto("/");
  await page.getByLabel("City, town or postal code").fill("London");
  await page.getByRole("button", { name: "Find my outfit" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Checking the forecast for London",
  );
  release();
  await expect(
    page.getByRole("heading", { name: "Jacket, jumper and trousers" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "London", exact: true }),
  ).toBeFocused();
  await expect(page.getByText("England, United Kingdom")).toBeVisible();
  await expect(page.getByRole("link", { name: /Open-Meteo/ })).toHaveAttribute(
    "href",
    "https://open-meteo.com/",
  );
  const fits = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(fits).toBe(true);
});

test("handles unknown locations and backend failures, then recovers", async ({
  page,
}) => {
  await page.route("**/api/advice?**", async (route) => {
    const location = new URL(route.request().url()).searchParams.get(
      "location",
    );
    if (location === "Nowhere")
      await route.fulfill({
        status: 404,
        json: { error: { code: "LOCATION_NOT_FOUND", message: "No match" } },
      });
    else if (location === "Offline")
      await route.fulfill({
        status: 502,
        json: { error: { code: "UPSTREAM_ERROR", message: "Unavailable" } },
      });
    else await route.fulfill({ json: demoAdvice });
  });
  await page.goto("/");
  const location = page.getByLabel("City, town or postal code");
  const submit = page.getByRole("button", { name: "Find my outfit" });
  await location.fill("Nowhere");
  await submit.click();
  await expect(page.getByRole("alert")).toContainText(
    "We couldn’t find that location",
  );
  await location.fill("Offline");
  await submit.click();
  await expect(page.getByRole("alert")).toContainText(
    "We couldn’t get your advice",
  );
  await location.fill("London");
  await submit.click();
  await expect(
    page.getByRole("heading", { name: "London", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("supports keyboard validation and a network failure", async ({ page }) => {
  await page.route("**/api/advice?**", (route) => route.abort("failed"));
  await page.goto("/");
  const location = page.getByLabel("City, town or postal code");
  await location.focus();
  await location.press("Enter");
  await expect(page.getByRole("alert")).toContainText("between 2 and 100");
  await expect(location).toBeFocused();
  await location.fill("London");
  await location.press("Enter");
  await expect(page.getByRole("alert")).toContainText("Check your connection");
});

test("keeps long negative temperatures and weather metrics inside narrow forecast cards", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 750 });
  await page.route("**/api/advice?**", (route) =>
    route.fulfill({
      json: {
        ...demoAdvice,
        weather: {
          ...demoAdvice.weather,
          feelsLike: { min: -15.4, max: -10.1, unit: "°C" },
          precipitationProbability: { max: 100, unit: "%" },
          windSpeed: { max: 112.8, unit: "km/h" },
        },
      },
    }),
  );
  await page.goto("/");
  await page.getByLabel("City, town or postal code").fill("London");
  await page.getByRole("button", { name: "Find my outfit" }).click();
  await expect(
    page.getByRole("heading", { name: "London", exact: true }),
  ).toBeVisible();
  const measurements = await page.locator(".weather-grid").evaluate((grid) => ({
    width: grid.clientWidth,
    content: grid.scrollWidth,
    cellsFit: [...grid.children].every(
      (cell) => cell.scrollWidth <= cell.clientWidth,
    ),
  }));
  expect(measurements.content).toBeLessThanOrEqual(measurements.width);
  expect(measurements.cellsFit).toBe(true);
});
