import Fastify from "fastify";
import { z } from "zod";
import { ApiError } from "./errors.js";
import { recommend } from "./recommendations.js";
import { createWeatherClient, type WeatherClientOptions } from "./weather.js";

const querySchema = z.strictObject({
  location: z.string().trim().min(2).max(100),
  countryCode: z
    .string()
    .regex(/^[a-zA-Z]{2}$/)
    .transform((value) => value.toUpperCase())
    .optional(),
});

export function buildApp(
  options: WeatherClientOptions & { logger?: boolean } = {},
) {
  const app = Fastify({ logger: options.logger ?? false });
  const getWeather = createWeatherClient(options);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return reply
        .status(error.statusCode)
        .send({ error: { code: error.code, message: error.message } });
    }
    if (
      error instanceof Error &&
      "statusCode" in error &&
      typeof error.statusCode === "number" &&
      error.statusCode >= 400 &&
      error.statusCode < 500
    ) {
      return reply.status(error.statusCode).send({
        error: {
          code: "INVALID_REQUEST",
          message: "The HTTP request could not be processed.",
        },
      });
    }
    request.log.error(error);
    return reply.status(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
      },
    });
  });
  app.setNotFoundHandler((_request, reply) =>
    reply.status(404).send({
      error: { code: "NOT_FOUND", message: "This endpoint does not exist." },
    }),
  );

  app.get("/health", () => ({ status: "ok" }));
  app.get("/api/advice", async (request, reply) => {
    const query = querySchema.safeParse(request.query);
    if (!query.success) {
      throw new ApiError(
        400,
        "INVALID_INPUT",
        "Provide one location (2–100 characters) and, optionally, one two-letter countryCode. No other query parameters are supported.",
      );
    }
    const forecast = await getWeather(
      query.data.location,
      query.data.countryCode,
    );
    reply.header("Cache-Control", "no-store");
    return {
      ...forecast,
      recommendations: recommend(forecast.weather),
      source: { name: "Open-Meteo", url: "https://open-meteo.com/" },
    };
  });
  return app;
}
