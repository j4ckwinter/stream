import type { Weather } from "./weather.js";

export interface Recommendation {
  item: string;
  reason: string;
}

export function recommend(weather: Weather): Recommendation[] {
  const { min, max } = weather.feelsLike;
  const recommendations: Recommendation[] = [];
  if (max < 5) {
    recommendations.push({
      item: "Winter coat, warm layers, trousers, hat and gloves",
      reason: `Even the warmest part of today feels like ${max}°C.`,
    });
  } else if (max < 15) {
    recommendations.push({
      item: "Jacket, jumper and trousers",
      reason: `Today's feels-like high is ${max}°C.`,
    });
  } else if (max < 23) {
    recommendations.push({
      item: "Light top, light layer and trousers",
      reason: `Today's feels-like high is ${max}°C; a removable layer gives flexibility.`,
    });
  } else {
    recommendations.push({
      item: "Light, breathable clothing",
      reason: `Today's feels-like high reaches ${max}°C.`,
    });
  }
  if (min < 5 && max >= 5) {
    recommendations.push({
      item: "Warm coat for early or late outings",
      reason: `The full-day feels-like low is ${min}°C, even though the afternoon may be warmer.`,
    });
  } else if (min < 15 && max >= 15) {
    recommendations.push({
      item: "Extra jumper for early or late outings",
      reason: `The full-day feels-like low is ${min}°C.`,
    });
  }
  if (
    weather.precipitationProbability.max >= 40 ||
    weather.precipitation.total >= 1
  ) {
    recommendations.push({
      item: "Waterproof outer layer and water-resistant shoes",
      reason: `Precipitation chance peaks at ${weather.precipitationProbability.max}%, with ${weather.precipitation.total} mm forecast.`,
    });
  }
  if (weather.windSpeed.max >= 30) {
    recommendations.push({
      item: "Wind-resistant outer layer",
      reason: `Wind speeds may reach ${weather.windSpeed.max} km/h.`,
    });
  }
  if (weather.uvIndex.max >= 3) {
    recommendations.push({
      item: "Sun hat and sunglasses",
      reason: `The UV index may reach ${weather.uvIndex.max}.`,
    });
  }
  return recommendations;
}
