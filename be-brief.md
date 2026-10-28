# What to Wear Today — Backend

Build a small API that helps a user decide what to wear today. A client gives the API a location; the API calls Open-Meteo and returns weather-based clothing advice.

Use TypeScript in a dedicated backend repository. Choose any backend framework and any agentic tool.

## What to build

- Accept a location and resolve it to coordinates. Open-Meteo's forecast endpoint takes latitude and longitude, not city names; its geocoding endpoint converts names to coordinates. How you bridge that gap is your call.
- Retrieve weather information from Open-Meteo and use it to recommend clothing for today.
- Decide what the recommendations contain and how they follow from the weather. That's part of what we're assessing.
- Return a JSON response containing the resolved location, relevant weather information with units, and clothing advice that a frontend can display.
- Handle missing or invalid input, a location that cannot be found, and an upstream service failure with clear API errors.

Choose and document the endpoint, request, response, and error format. Explain how you handle ambiguous location names and what "today" means for the requested location. If a frontend is being built alongside the API, agree on the contract before starting.

## Time and scope

You have 40 minutes to build. We're looking for something working that you'd be happy to demo, and clear thinking about what you chose to do and leave out.

Persistence (a database) and automated testing are not in scope to build. We'll discuss both in the debrief. A frontend is not required for the backend exercise.

## Demo and handover

Provide instructions for running the API locally and example requests that can be run with curl or an API client. Demonstrate a successful request using Open-Meteo and how the API handles invalid input or an unknown location. Be ready to explain your recommendation logic, upstream failure handling, assumptions, and limitations.

Before you start, you've got 5 minutes to ask any clarifying questions you'd like. What would you like to know?
