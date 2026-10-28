import { AdviceError, type Advice, type AdviceClient } from "./api";

export const demoAdvice: Advice = {
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
    feelsLike: { min: 8, max: 14, unit: "°C" },
    precipitationProbability: { max: 80, unit: "%" },
    precipitation: { total: 4.2, unit: "mm" },
    windSpeed: { max: 24, unit: "km/h" },
    uvIndex: { max: 2, unit: "index" },
  },
  recommendations: [
    {
      item: "Jacket, jumper and trousers",
      reason: "Today's feels-like high is 14°C.",
    },
    {
      item: "Waterproof outer layer and water-resistant shoes",
      reason: "Precipitation chance peaks at 80%, with 4.2 mm forecast.",
    },
  ],
  source: { name: "Open-Meteo", url: "https://open-meteo.com/" },
};

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Request cancelled", "AbortError"));
      return;
    }
    const cancel = () => {
      clearTimeout(timer);
      reject(new DOMException("Request cancelled", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", cancel);
      resolve();
    }, ms);
    signal?.addEventListener("abort", cancel, { once: true });
  });
}

export const getDemoAdvice: AdviceClient = async (query, signal) => {
  const location = query.location.trim().toLowerCase();
  await delay(location === "slow" ? 2500 : 800, signal);
  if (location === "offline") {
    throw new AdviceError(
      "request",
      "We couldn't get the weather right now. Please try again.",
    );
  }
  if (location !== "london" && location !== "slow") {
    throw new AdviceError(
      "not-found",
      "This demo only has a London forecast. Try London for sample advice.",
    );
  }
  return structuredClone(demoAdvice);
};
