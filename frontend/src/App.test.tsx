import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { AdviceError, type Advice, type AdviceClient } from "./api";
import { demoAdvice } from "./demo";

async function enterLocation(value: string) {
  const user = userEvent.setup();
  await user.clear(screen.getByLabelText("City, town or postal code"));
  await user.type(screen.getByLabelText("City, town or postal code"), value);
  return user;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe("location and advice interface", () => {
  it("starts without requesting weather and validates blank, short and oversized locations", async () => {
    const client = vi.fn<AdviceClient>();
    render(<App getAdvice={client} />);
    const user = userEvent.setup();
    expect(client).not.toHaveBeenCalled();
    for (const input of ["", "a", "a".repeat(101)]) {
      await user.clear(screen.getByLabelText("City, town or postal code"));
      if (input)
        await user.type(
          screen.getByLabelText("City, town or postal code"),
          input,
        );
      await user.click(screen.getByRole("button", { name: "Find my outfit" }));
      expect(screen.getByRole("alert")).toHaveTextContent("between 2 and 100");
      expect(screen.getByLabelText("City, town or postal code")).toHaveFocus();
    }
    expect(client).not.toHaveBeenCalled();
  });

  it("validates the optional country and submits trimmed input with uppercase country", async () => {
    const client = vi.fn<AdviceClient>().mockResolvedValue(demoAdvice);
    render(<App getAdvice={client} />);
    const user = await enterLocation(" London ");
    await user.type(screen.getByLabelText("Country (optional)"), "UKK");
    await user.click(screen.getByRole("button", { name: "Find my outfit" }));
    expect(screen.getByRole("alert")).toHaveTextContent("two-letter");
    expect(client).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText("Country (optional)"));
    await user.type(screen.getByLabelText("Country (optional)"), " gb ");
    await user.click(screen.getByRole("button", { name: "Find my outfit" }));
    expect(client).toHaveBeenCalledWith(
      { location: "London", countryCode: "GB" },
      expect.any(AbortSignal),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "London" }),
    ).toHaveFocus();
  });

  it("announces pending work and renders the returned outfit, extras, weather and resolved location", async () => {
    const request = deferred<Advice>();
    render(<App getAdvice={() => request.promise} />);
    const user = await enterLocation("London");
    await user.click(screen.getByRole("button", { name: "Find my outfit" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Checking the forecast for London",
    );
    expect(screen.getByRole("button", { name: "Checking…" })).toBeDisabled();
    expect(
      screen.queryByText("Jacket, jumper and trousers"),
    ).not.toBeInTheDocument();
    await act(async () => request.resolve(demoAdvice));
    expect(screen.getByRole("heading", { name: "London" })).toBeInTheDocument();
    expect(screen.getByText("England, United Kingdom")).toBeInTheDocument();
    expect(screen.getByText("Europe/London")).toBeInTheDocument();
    expect(screen.getByText("Wednesday, 28 October 2026")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Jacket, jumper and trousers" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Waterproof outer layer and water-resistant shoes",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("4.2 mm total")).toBeInTheDocument();
    expect(screen.getByText(/8–14/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open-Meteo/ })).toHaveAttribute(
      "href",
      "https://open-meteo.com/",
    );
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it.each([
    [
      new AdviceError("not-found", "Try a nearby town."),
      "We couldn’t find that location",
    ],
    [
      new AdviceError("request", "Please try again."),
      "We couldn’t get your advice",
    ],
    [
      new AdviceError("timeout", "The request took too long."),
      "We couldn’t get your advice",
    ],
    [new Error("private internal detail"), "We couldn’t get your advice"],
  ])(
    "handles %s and lets the user recover with another location",
    async (failure, title) => {
      const client = vi
        .fn<AdviceClient>()
        .mockRejectedValueOnce(failure)
        .mockResolvedValueOnce(demoAdvice);
      render(<App getAdvice={client} />);
      const user = await enterLocation("Unknown");
      await user.click(screen.getByRole("button", { name: "Find my outfit" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(title);
      expect(
        screen.queryByText("private internal detail"),
      ).not.toBeInTheDocument();
      await enterLocation("London");
      await user.click(screen.getByRole("button", { name: "Find my outfit" }));
      expect(
        await screen.findByRole("heading", { name: "London" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    },
  );

  it("cancels a pending search and ignores its late result after a newer search succeeds", async () => {
    const older = deferred<Advice>();
    const client = vi
      .fn<AdviceClient>()
      .mockReturnValueOnce(older.promise)
      .mockResolvedValueOnce({
        ...demoAdvice,
        location: { ...demoAdvice.location, name: "Paris" },
      });
    render(<App getAdvice={client} />);
    const user = await enterLocation("London");
    await user.click(screen.getByRole("button", { name: "Find my outfit" }));
    const oldSignal = client.mock.calls[0]?.[1];
    await user.click(screen.getByRole("button", { name: "Cancel search" }));
    expect(oldSignal?.aborted).toBe(true);
    expect(screen.getByLabelText("City, town or postal code")).toHaveFocus();
    await enterLocation("Paris");
    await user.click(screen.getByRole("button", { name: "Find my outfit" }));
    await screen.findByRole("heading", { name: "Paris" });
    await act(async () => older.resolve(demoAdvice));
    expect(screen.getByRole("heading", { name: "Paris" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "London" }),
    ).not.toBeInTheDocument();
  });

  it("clears old advice when a new request starts and fails", async () => {
    const next = deferred<Advice>();
    const client = vi
      .fn<AdviceClient>()
      .mockResolvedValueOnce(demoAdvice)
      .mockReturnValueOnce(next.promise);
    render(<App getAdvice={client} />);
    const user = await enterLocation("London");
    await user.click(screen.getByRole("button", { name: "Find my outfit" }));
    await screen.findByRole("heading", { name: "London" });
    await enterLocation("Paris");
    await user.click(screen.getByRole("button", { name: "Find my outfit" }));
    expect(
      screen.queryByRole("heading", { name: "London" }),
    ).not.toBeInTheDocument();
    await act(async () =>
      next.reject(new AdviceError("request", "Please try again.")),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Please try again.");
    expect(
      screen.queryByRole("heading", { name: "London" }),
    ).not.toBeInTheDocument();
  });

  it("handles null location metadata and a single recommendation", async () => {
    const advice: Advice = {
      ...demoAdvice,
      location: {
        ...demoAdvice.location,
        region: null,
        country: null,
        countryCode: null,
      },
      recommendations: [{ item: "Warm layers", reason: "A cold day." }],
    };
    render(<App getAdvice={async () => advice} />);
    const user = await enterLocation("London");
    await user.click(screen.getByRole("button", { name: "Find my outfit" }));
    await screen.findByRole("heading", { name: "Warm layers" });
    expect(screen.queryByText("Before you head out")).not.toBeInTheDocument();
    expect(screen.queryByText("null")).not.toBeInTheDocument();
  });

  it("aborts work on unmount", async () => {
    const client = vi.fn<AdviceClient>().mockReturnValue(new Promise(() => {}));
    const { unmount } = render(<App getAdvice={client} />);
    const user = await enterLocation("London");
    await user.click(screen.getByRole("button", { name: "Find my outfit" }));
    unmount();
    await waitFor(() => expect(client.mock.calls[0]?.[1]?.aborted).toBe(true));
  });

  it("labels sample mode explicitly", () => {
    render(<App getAdvice={vi.fn()} demo />);
    expect(screen.getByText("Demo mode · sample weather")).toBeInTheDocument();
    expect(screen.getByText("Nowhere")).toBeInTheDocument();
  });
});
