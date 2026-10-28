import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AdviceError,
  type Advice,
  type AdviceClient,
  type AdviceQuery,
} from "./api";

type RequestState =
  | { status: "idle" }
  | { status: "loading"; query: AdviceQuery }
  | { status: "success"; advice: Advice }
  | { status: "error"; title: string; message: string };

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

function AdviceResults({ advice }: { advice: Advice }) {
  const { location, weather, recommendations } = advice;
  const [outfit, ...extras] = recommendations;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);

  return (
    <section className="results" aria-labelledby="results-heading">
      <div className="result-heading">
        <div>
          <p className="eyebrow">Your day, dressed</p>
          <h2 id="results-heading" ref={heading} tabIndex={-1}>
            {location.name}
          </h2>
          <p className="place-detail">
            {[location.region, location.country].filter(Boolean).join(", ")}
          </p>
        </div>
        <p className="date">
          {formatDate(advice.date)}
          <span>{location.timezone}</span>
        </p>
      </div>

      {outfit && (
        <article className="outfit-card">
          <div className="outfit-icon" aria-hidden="true">
            <svg viewBox="0 0 80 80" fill="none">
              <path
                d="m28 15-17 10 8 16 10-5v29h24V36l9 5 8-16-18-10c-2 10-21 10-24 0Z"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              <path
                d="M31 16c1 7 17 7 19 0"
                stroke="currentColor"
                strokeWidth="2.5"
              />
            </svg>
          </div>
          <div>
            <p className="eyebrow">Start with this</p>
            <h3>{outfit.item}</h3>
            <p>{outfit.reason}</p>
          </div>
        </article>
      )}

      {extras.length > 0 && (
        <div className="extras">
          <h3 className="section-label">Before you head out</h3>
          <ul className="extras-list">
            {extras.map((item, index) => (
              <li key={`${item.item}-${index}`}>
                <span className="check-mark" aria-hidden="true">
                  ✓
                </span>
                <div>
                  <h4>{item.item}</h4>
                  <p>{item.reason}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="forecast" aria-labelledby="forecast-heading">
        <div className="section-heading">
          <h3 id="forecast-heading">The forecast behind it</h3>
          <span>Full-day outlook</span>
        </div>
        <dl className="weather-grid">
          <div>
            <dt>Feels like</dt>
            <dd>
              {weather.feelsLike.min}–<wbr />
              {weather.feelsLike.max}
              <small> °C</small>
            </dd>
            <dd className="metric-note">Daily low to high</dd>
          </div>
          <div>
            <dt>Precipitation chance</dt>
            <dd>
              {weather.precipitationProbability.max}
              <small>%</small>
            </dd>
            <dd className="metric-note">
              {weather.precipitation.total} mm total
            </dd>
          </div>
          <div>
            <dt>Wind speed</dt>
            <dd>
              {weather.windSpeed.max}
              <small> km/h</small>
            </dd>
            <dd className="metric-note">Daily maximum</dd>
          </div>
          <div>
            <dt>UV index</dt>
            <dd>{weather.uvIndex.max}</dd>
            <dd className="metric-note">Daily maximum</dd>
          </div>
        </dl>
        <p className="forecast-note">
          This covers the whole day at your location, including overnight.
          Layers can help with changing conditions.
        </p>
      </section>
      <p className="attribution">
        Weather by{" "}
        <a href={advice.source.url} target="_blank" rel="noreferrer">
          {advice.source.name}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>{" "}
        · General guidance, tailored to the weather.
      </p>
    </section>
  );
}

export function App({
  getAdvice,
  demo = false,
}: {
  getAdvice: AdviceClient;
  demo?: boolean;
}) {
  const [location, setLocation] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [validation, setValidation] = useState<{
    field: "location" | "country";
    message: string;
  } | null>(null);
  const [state, setState] = useState<RequestState>({ status: "idle" });
  const activeRequest = useRef<AbortController | null>(null);
  const locationInput = useRef<HTMLInputElement>(null);
  const countryInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => activeRequest.current?.abort(), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const place = location.trim();
    const country = countryCode.trim().toUpperCase();
    if (place.length < 2 || place.length > 100) {
      setValidation({
        field: "location",
        message: "Enter a location between 2 and 100 characters.",
      });
      locationInput.current?.focus();
      return;
    }
    if (country && !/^[A-Z]{2}$/.test(country)) {
      setValidation({
        field: "country",
        message:
          "Use a two-letter country code, such as GB or US, or leave it blank.",
      });
      countryInput.current?.focus();
      return;
    }
    setValidation(null);
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const query = {
      location: place,
      ...(country ? { countryCode: country } : {}),
    };
    setState({ status: "loading", query });
    try {
      const advice = await getAdvice(query, controller.signal);
      if (activeRequest.current === controller && !controller.signal.aborted) {
        setState({ status: "success", advice });
      }
    } catch (error) {
      if (activeRequest.current !== controller || controller.signal.aborted)
        return;
      setState({
        status: "error",
        title:
          error instanceof AdviceError && error.kind === "not-found"
            ? "We couldn’t find that location"
            : "We couldn’t get your advice",
        message:
          error instanceof AdviceError
            ? error.message
            : "Something went wrong. Please try again in a moment.",
      });
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
    }
  }

  function cancel() {
    activeRequest.current?.abort();
    activeRequest.current = null;
    setState({ status: "idle" });
    locationInput.current?.focus();
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="wordmark" href="./">
          <span className="brand-mark" aria-hidden="true">
            w.
          </span>
          What to wear
        </a>
        <span className="header-note">A little less guesswork.</span>
      </header>
      <main>
        <section className="intro" aria-labelledby="page-title">
          <div className="sun-drawing" aria-hidden="true">
            <span />
          </div>
          <p className="eyebrow">Ready for the day</p>
          <h1 id="page-title">
            Good weather.
            <br />
            Bad weather.
            <br />
            <em>Right outfit.</em>
          </h1>
          <p className="intro-copy">
            A forecast is useful. Knowing what to wear is better.
            <br className="desktop-break" /> Tell us where you’re headed. We’ll
            help with the layers.
          </p>
        </section>

        {demo && (
          <aside className="demo-banner">
            <strong>Demo mode · sample weather</strong>
            <p>
              Try <b>London</b> for advice, <b>Slow</b> for loading,{" "}
              <b>Nowhere</b> for an unknown location, or <b>Offline</b> for a
              failed request. Successful demos show London sample data.
            </p>
          </aside>
        )}

        <section className="search-panel" aria-labelledby="search-heading">
          <h2 id="search-heading">Where are you headed?</h2>
          <form onSubmit={(event) => void submit(event)} noValidate>
            <div className="form-fields">
              <div className="location-field">
                <label htmlFor="location">City, town or postal code</label>
                <input
                  ref={locationInput}
                  id="location"
                  name="location"
                  placeholder="e.g. London"
                  autoComplete="address-level2"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  aria-invalid={validation?.field === "location"}
                  aria-describedby={
                    validation?.field === "location"
                      ? "validation-message"
                      : "location-hint"
                  }
                />
              </div>
              <div className="country-field">
                <label htmlFor="country">
                  Country <span>(optional)</span>
                </label>
                <input
                  ref={countryInput}
                  id="country"
                  name="countryCode"
                  placeholder="e.g. GB"
                  autoComplete="country"
                  value={countryCode}
                  onChange={(event) => setCountryCode(event.target.value)}
                  aria-invalid={validation?.field === "country"}
                  aria-describedby={
                    validation?.field === "country"
                      ? "validation-message"
                      : "country-hint"
                  }
                />
              </div>
              <button
                className="primary-button"
                type="submit"
                disabled={state.status === "loading"}
              >
                {state.status === "loading" ? "Checking…" : "Find my outfit"}
                <span aria-hidden="true">↗</span>
              </button>
            </div>
            <p id="location-hint" className="form-hint">
              We’ll show the first matching place.{" "}
              <span id="country-hint">
                Add a two-letter country code to narrow the search.
              </span>
            </p>
            {validation && (
              <p id="validation-message" className="validation" role="alert">
                {validation.message}
              </p>
            )}
          </form>
        </section>

        <div
          className="request-status"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {state.status === "loading" && (
            <div className="loading-panel">
              <span className="spinner" aria-hidden="true" />
              <div>
                <strong>
                  Checking the forecast for {state.query.location}…
                </strong>
                <p>Finding the right layers for your day.</p>
              </div>
            </div>
          )}
        </div>
        {state.status === "loading" && (
          <button className="text-button cancel-button" onClick={cancel}>
            Cancel search
          </button>
        )}
        {state.status === "error" && (
          <section className="error-panel" role="alert">
            <h2>{state.title}</h2>
            <p>{state.message}</p>
            <p>
              Edit the location above or select “Find my outfit” to try again.
            </p>
          </section>
        )}
        {state.status === "success" && <AdviceResults advice={state.advice} />}
        {state.status === "idle" && (
          <div className="empty-state">
            <span aria-hidden="true">↗</span>
            <p>
              Your day starts here.
              <br />
              <strong>One location. A little outfit inspiration.</strong>
            </p>
          </div>
        )}
      </main>
      <footer className="site-footer">
        <span>For whatever’s outside.</span>
        <span>No account. Just a little direction.</span>
      </footer>
    </div>
  );
}
