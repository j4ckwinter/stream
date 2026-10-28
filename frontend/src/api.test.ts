import { afterEach, describe, expect, it, vi } from "vitest";
import { getAdvice } from "./api";
import { demoAdvice, getDemoAdvice } from "./demo";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function respond(body: unknown, status = 200) {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}

function pendingRequest() {
  vi.stubGlobal(
    "fetch",
    vi.fn((_url: string, options: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        options.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Request cancelled", "AbortError")),
          { once: true },
        );
      });
    }),
  );
}

describe("live advice API", () => {
  it("validates success and encodes the location and optional country", async () => {
    const fetcher = respond(demoAdvice);
    await expect(
      getAdvice({ location: "  St John's & East  ", countryCode: "gb" }),
    ).resolves.toEqual(demoAdvice);
    const [url, options] = fetcher.mock.calls[0] as [string, RequestInit];
    const parsed = new URL(url, "http://localhost");
    expect(parsed.pathname).toBe("/api/advice");
    expect([...parsed.searchParams.entries()]).toEqual([
      ["location", "St John's & East"],
      ["countryCode", "GB"],
    ]);
    expect(options.headers).toEqual({ Accept: "application/json" });
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(options.cache).toBe("no-store");
  });

  it("omits an absent country and accepts nullable location metadata", async () => {
    const data = structuredClone(demoAdvice);
    data.location.region = null;
    data.location.country = null;
    data.location.countryCode = null;
    const fetcher = respond(data);
    await expect(getAdvice({ location: "London" })).resolves.toEqual(data);
    expect(fetcher.mock.calls[0]?.[0]).toBe("/api/advice?location=London");
  });

  it.each([
    { location: " " },
    { location: "a" },
    { location: "x".repeat(101) },
    { location: "London", countryCode: "UKK" },
  ])("rejects invalid query input before fetching: %j", async (query) => {
    const fetcher = respond(demoAdvice);
    await expect(getAdvice(query)).rejects.toMatchObject({
      kind: "invalid-input",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    [404, "LOCATION_NOT_FOUND", "not-found"],
    [404, "NOT_FOUND", "request"],
    [400, "INVALID_INPUT", "invalid-input"],
    [502, "UPSTREAM_ERROR", "request"],
    [504, "UPSTREAM_TIMEOUT", "timeout"],
    [500, "INTERNAL_ERROR", "request"],
  ])("maps status %s and %s to %s", async (status, code, kind) => {
    respond({ error: { code, message: "Server message" } }, status);
    await expect(getAdvice({ location: "London" })).rejects.toMatchObject({
      kind,
    });
  });

  it("handles a non-contract HTTP error without trusting its message", async () => {
    respond({ surprise: "unavailable" }, 503);
    await expect(getAdvice({ location: "London" })).rejects.toMatchObject({
      kind: "request",
    });
  });

  it.each([
    { ...demoAdvice, recommendations: [] },
    { ...demoAdvice, date: "2026-02-30" },
    { ...demoAdvice, source: { name: "bad", url: "javascript:alert(1)" } },
    { ...demoAdvice, weather: { ...demoAdvice.weather, uvIndex: null } },
    {
      ...demoAdvice,
      weather: {
        ...demoAdvice.weather,
        feelsLike: { min: 20, max: 10, unit: "°C" },
      },
    },
    {
      ...demoAdvice,
      weather: {
        ...demoAdvice.weather,
        precipitationProbability: { max: 101, unit: "%" },
      },
    },
  ])("rejects unusable success data", async (body) => {
    respond(body);
    await expect(getAdvice({ location: "London" })).rejects.toMatchObject({
      kind: "request",
    });
  });

  it("handles malformed JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>")));
    await expect(getAdvice({ location: "London" })).rejects.toMatchObject({
      kind: "request",
    });
  });

  it("handles a network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    await expect(getAdvice({ location: "London" })).rejects.toMatchObject({
      kind: "request",
    });
  });

  it("aborts after a 15-second deadline", async () => {
    vi.useFakeTimers();
    pendingRequest();
    const result = expect(
      getAdvice({ location: "London" }),
    ).rejects.toMatchObject({
      kind: "timeout",
    });
    await vi.advanceTimersByTimeAsync(15_000);
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("preserves caller cancellation instead of showing a request error", async () => {
    vi.useFakeTimers();
    pendingRequest();
    const controller = new AbortController();
    const result = expect(
      getAdvice({ location: "London" }, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not fetch an already cancelled request", async () => {
    const fetcher = respond(demoAdvice);
    const controller = new AbortController();
    controller.abort();
    await expect(
      getAdvice({ location: "London" }, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("demo advice", () => {
  it("shows delayed sample data without fetching", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const pending = getDemoAdvice({ location: " London " });
    await vi.advanceTimersByTimeAsync(800);
    await expect(pending).resolves.toEqual(demoAdvice);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    ["Nowhere", "not-found"],
    ["Offline", "request"],
  ])("supports the %s failure scenario", async (location, kind) => {
    vi.useFakeTimers();
    const result = expect(getDemoAdvice({ location })).rejects.toMatchObject({
      kind,
    });
    await vi.advanceTimersByTimeAsync(800);
    await result;
  });

  it("supports cancellation while a sample is loading", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const result = expect(
      getDemoAdvice({ location: "Slow" }, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });
});
