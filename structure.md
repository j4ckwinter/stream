# Prompt structure

**Implement → Interrogate → Decide → Resolve → Understand**

1. **Implement:** `/pancake` — handles implementation, review, and verification.
2. **Interrogate:** `/interrogate` — adds a separate adversarial review.
3. **Decide:** Choose which findings need action.
4. **Resolve:** `/pancake` — fixes accepted findings, reviews, and verifies the changes.
5. **Understand:** `/pancake` - request a walkthrough of decisions and limitations.


# Example prompt
/pancake Implement brief.md in TypeScript. We have 40 minutes. Provide a runnable solution, tests, linting and formatting checks, and instructions for running and exercising it.