import { z } from "zod";

const adviceSchema = z.object({
  location: z.object({
    name: z.string().min(1),
    region: z.string().nullable(),
    country: z.string().nullable(),
    countryCode: z.string().nullable(),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    timezone: z.string().min(1),
  }),
  date: z.iso.date(),
  weather: z.object({
    feelsLike: z
      .object({ min: z.number(), max: z.number(), unit: z.literal("°C") })
      .refine(({ min, max }) => min <= max),
    precipitationProbability: z.object({
      max: z.number().min(0).max(100),
      unit: z.literal("%"),
    }),
    precipitation: z.object({
      total: z.number().nonnegative(),
      unit: z.literal("mm"),
    }),
    windSpeed: z.object({
      max: z.number().nonnegative(),
      unit: z.literal("km/h"),
    }),
    uvIndex: z.object({
      max: z.number().nonnegative(),
      unit: z.literal("index"),
    }),
  }),
  recommendations: z
    .array(z.object({ item: z.string().min(1), reason: z.string().min(1) }))
    .min(1),
  source: z.object({
    name: z.string().min(1),
    url: z.url({ protocol: /^https?$/ }),
  }),
});

const querySchema = z.object({
  location: z.string().trim().min(2).max(100),
  countryCode: z
    .string()
    .trim()
    .regex(/^[a-zA-Z]{2}$/)
    .transform((code) => code.toUpperCase())
    .optional(),
});

const errorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});

export type Advice = z.infer<typeof adviceSchema>;
export interface AdviceQuery {
  location: string;
  countryCode?: string;
}
export type AdviceClient = (
  query: AdviceQuery,
  signal?: AbortSignal,
) => Promise<Advice>;

export class AdviceError extends Error {
  constructor(
    public readonly kind: "not-found" | "request" | "timeout" | "invalid-input",
    message: string,
  ) {
    super(message);
    this.name = "AdviceError";
  }
}

function responseError(status: number, body: unknown): AdviceError {
  const parsed = errorSchema.safeParse(body);
  const code = parsed.success ? parsed.data.error.code : undefined;
  if (status === 404 && code === "LOCATION_NOT_FOUND") {
    return new AdviceError(
      "not-found",
      "We couldn't find that location. Check the spelling, try a nearby town, or add a country code.",
    );
  }
  if (status === 400 && code === "INVALID_INPUT") {
    return new AdviceError(
      "invalid-input",
      "Enter a location with 2–100 characters and, optionally, a two-letter country code.",
    );
  }
  if (status === 504 || code === "UPSTREAM_TIMEOUT") {
    return new AdviceError(
      "timeout",
      "The weather service took too long to respond. Please try again.",
    );
  }
  return new AdviceError(
    "request",
    "We couldn't get the weather right now. Please try again.",
  );
}

export const getAdvice: AdviceClient = async (query, signal) => {
  if (signal?.aborted)
    throw new DOMException("Request cancelled", "AbortError");
  const parsedQuery = querySchema.safeParse(query);
  if (!parsedQuery.success) {
    throw new AdviceError(
      "invalid-input",
      "Enter a location with 2–100 characters and, optionally, a two-letter country code.",
    );
  }
  const params = new URLSearchParams({ location: parsedQuery.data.location });
  if (parsedQuery.data.countryCode) {
    params.set("countryCode", parsedQuery.data.countryCode);
  }
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 15_000);

  try {
    const response = await fetch(`/api/advice?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const body: unknown = await response.json();
    if (!response.ok) throw responseError(response.status, body);
    const parsed = adviceSchema.safeParse(body);
    if (!parsed.success) {
      throw new AdviceError(
        "request",
        "The weather service returned incomplete information. Please try again.",
      );
    }
    return parsed.data;
  } catch (error) {
    if (signal?.aborted)
      throw new DOMException("Request cancelled", "AbortError");
    if (timedOut) {
      throw new AdviceError(
        "timeout",
        "The weather service took too long to respond. Please try again.",
      );
    }
    if (error instanceof AdviceError) throw error;
    throw new AdviceError(
      "request",
      "We couldn't connect to the weather service. Check your connection and try again.",
    );
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
};
