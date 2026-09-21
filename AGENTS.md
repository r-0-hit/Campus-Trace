# Campus Trace contributor guide

## Safety, privacy, and clinical boundaries

- Treat health and proximity information as sensitive. Minimize it in APIs, logs, UI, and test fixtures.
- Never call an ML risk score a diagnosis, confirmed infection, or medically validated probability.
- Label all generated records and model outputs as **demo / synthetic data**.
- Never reveal an index case or another student's health information to a student. Teachers receive only authorized aggregate information.
- Enforce role-based authorization in backend routes; frontend guards are usability features, not security controls.
- Use pseudonymous student identifiers in visualizations and demo content whenever possible.

## Engineering rules

- Keep React components free of business rules, Cypher, and ML implementation details.
- Keep graph, risk, simulation, notification, and investigation logic in dedicated backend services.
- Validate all API inputs and do not silently swallow exceptions.
- Use environment variables for secrets. Never commit `.env`, databases, generated credentials, or private health data.
- Every user-facing async action needs loading, success, empty, and useful error states. Do not leave dead buttons.
- Use bounded graph traversals and avoid repeated nodes or uncontrolled cycles.
- Run relevant tests after each major change and only claim tests that actually ran.
- Use current documentation when a third-party API or version behavior is uncertain.

## Development expectations

- Preserve existing user work and make small, reviewable changes.
- Keep the local Docker environment the primary full-stack development path.
- Add audit events for sensitive administrative or health-data workflows, without including unnecessary medical detail.
- Review every feature for least-privilege access, accessibility, and the prototype medical disclaimer.
