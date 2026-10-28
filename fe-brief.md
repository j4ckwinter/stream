# What to Wear Today — Frontend

Build a small web app that helps a user decide what to wear today. They give the app a location; the app shows weather-based clothing advice.

Use TypeScript in a dedicated frontend repository. Choose any frontend framework and any agentic tool.

## What to build

- Let the user enter a location and request advice.
- Display the resolved location, relevant weather information, and clothing recommendations returned by an API.
- Decide how to present the advice so it helps someone choose what to wear. That's part of what we're assessing.
- Handle loading, an unrecognised location, and a failed request with clear feedback. Let the user try another location.

The backend is responsible for resolving locations, calling Open-Meteo, and deciding what clothing to recommend. You do not need to build those parts for this exercise.

If a backend is available, agree on its API contract and use it. Otherwise, use a mocked API with representative responses for success, location not found, and request failure. Document the assumed request and response format so a real backend can replace the mock. Keep API access separate from the display code.

## Time and scope

You have 40 minutes to build. We're looking for something working that you'd be happy to demo, and clear thinking about what you chose to do and leave out. Visual polish is secondary to a useful, understandable experience.

Persistence (a database) and automated testing are not in scope to build. We'll discuss both in the debrief. A working backend is not required for the frontend exercise.

## Demo and handover

Provide instructions for running the app locally and state whether it uses a live backend or a mock. Demonstrate a successful request and how the interface handles loading and failures. Be ready to explain your presentation choices, assumptions, and limitations.

Before you start, you've got 5 minutes to ask any clarifying questions you'd like. What would you like to know?
