import { z } from "zod";
import { ApiError } from "./errors.js";

const locationSchema = z.object({
  name: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  country: z.string().optional(),
  country_code: z.string().optional(),
  admin1: z.string().optional(),
});
const geocodingSchema = z.object({
  results: z.array(locationSchema).optional(),
});
const forecastSchema = z.object({
  timezone: z.string().min(1),
  daily_units: z.object({
    time: z.literal("iso8601"),
    apparent_temperature_min: z.literal("°C"),
    apparent_temperature_max: z.literal("°C"),
    precipitation_probability_max: z.literal("%"),
    precipitation_sum: z.literal("mm"),
    wind_speed_10m_max: z.literal("km/h"),
    uv_index_max: z.literal(""),
  }),
  daily: z
    .object({
      time: z.tuple([z.iso.date()]),
      apparent_temperature_min: z.tuple([z.number()]),
      apparent_temperature_max: z.tuple([z.number()]),
      precipitation_probability_max: z.tuple([z.number().min(0).max(100)]),
      precipitation_sum: z.tuple([z.number().nonnegative()]),
      wind_speed_10m_max: z.tuple([z.number().nonnegative()]),
      uv_index_max: z.tuple([z.number().nonnegative()]),
    })
    .refine(
      (daily) =>
        daily.apparent_temperature_min[0] <= daily.apparent_temperature_max[0],
    ),
});

export interface Weather {
  feelsLike: { min: number; max: number; unit: "°C" };
  precipitationProbability: { max: number; unit: "%" };
  precipitation: { total: number; unit: "mm" };
  windSpeed: { max: number; unit: "km/h" };
  uvIndex: { max: number; unit: "index" };
}

export interface WeatherClientOptions {
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

export function createWeatherClient(options: WeatherClientOptions = {}) {
  const fetcher = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 5000;

  async function getJson(url: URL): Promise<unknown> {
    const signal = AbortSignal.timeout(timeoutMs);
    try {
      const response = await fetcher(url, { signal });
      if (!response.ok) {
        throw new ApiError(
          502,
          "UPSTREAM_ERROR",
          "The weather service is unavailable. Please try again.",
        );
      }
      const body: unknown = await response.json();
      return body;
    } catch (error) {
      if (signal.aborted) {
        throw new ApiError(
          504,
          "UPSTREAM_TIMEOUT",
          "The weather service took too long to respond. Please try again.",
        );
      }
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        502,
        "UPSTREAM_ERROR",
        "The weather service returned an unusable response. Please try again.",
      );
    }
  }

  return async function getWeather(location: string, countryCode?: string) {
    const geocodingUrl = new URL(
      "https://geocoding-api.open-meteo.com/v1/search",
    );
    geocodingUrl.search = new URLSearchParams({
      name: location,
      count: "1",
      language: "en",
      format: "json",
      ...(countryCode ? { countryCode } : {}),
    }).toString();
    const geocoding = geocodingSchema.safeParse(await getJson(geocodingUrl));
    if (!geocoding.success) {
      throw new ApiError(
        502,
        "UPSTREAM_ERROR",
        "The location service returned an unusable response.",
      );
    }
    const resolved = geocoding.data.results?.[0];
    if (!resolved)
      throw new ApiError(
        404,
        "LOCATION_NOT_FOUND",
        "No matching location was found. Try another name or country code.",
      );

    const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
    forecastUrl.search = new URLSearchParams({
      latitude: String(resolved.latitude),
      longitude: String(resolved.longitude),
      daily:
        "apparent_temperature_min,apparent_temperature_max,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,uv_index_max",
      timezone: "auto",
      forecast_days: "1",
      temperature_unit: "celsius",
      wind_speed_unit: "kmh",
      precipitation_unit: "mm",
    }).toString();
    const forecast = forecastSchema.safeParse(await getJson(forecastUrl));
    if (!forecast.success)
      throw new ApiError(
        502,
        "UPSTREAM_ERROR",
        "The weather service returned incomplete or invalid forecast data.",
      );
    const { daily, timezone } = forecast.data;
    const weather: Weather = {
      feelsLike: {
        min: daily.apparent_temperature_min[0],
        max: daily.apparent_temperature_max[0],
        unit: "°C",
      },
      precipitationProbability: {
        max: daily.precipitation_probability_max[0],
        unit: "%",
      },
      precipitation: { total: daily.precipitation_sum[0], unit: "mm" },
      windSpeed: { max: daily.wind_speed_10m_max[0], unit: "km/h" },
      uvIndex: { max: daily.uv_index_max[0], unit: "index" },
    };
    return {
      location: {
        name: resolved.name,
        region: resolved.admin1 ?? null,
        country: resolved.country ?? null,
        countryCode: resolved.country_code ?? null,
        latitude: resolved.latitude,
        longitude: resolved.longitude,
        timezone,
      },
      date: daily.time[0],
      weather,
    };
  };
}
