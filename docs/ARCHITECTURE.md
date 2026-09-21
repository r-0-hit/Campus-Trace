# Architecture

Campus Trace is a local-first, demo-only contact-tracing and early-warning prototype. It models **estimated exposure risk**, not diagnosis or infection probability.

```text
React + TypeScript client
          |
          v
FastAPI REST API — authentication, RBAC, validation, audit middleware
          |
          +-- application services: cases, investigations, notifications,
          |   simulation, disease configuration, exposure risk
          |
          +-- PostgreSQL: transactional and role-governed records
          +-- Neo4j: pseudonymous contacts, locations, traversal paths
          +-- model service: versioned, replaceable synthetic-data model
```

## Boundaries

- **Frontend** handles presentation, accessible forms, route experience, and calls to the API. It never makes authorization decisions or talks to Neo4j/ML directly.
- **API layer** authenticates, authorizes, validates, maps transport schemas, and returns safe error responses.
- **Services** contain use cases and orchestrate repositories, graph traversal, risk calculation, and notifications.
- **PostgreSQL** owns users, roles, cases, symptoms, notifications, audits, settings, and investigations.
- **Neo4j** owns contact-event topology, locations, relationships, traversal paths, and cluster candidates.
- **ML** has a stable feature schema and a model registry. Its synthetic-data outputs are explicitly marked non-clinical.

## Security and privacy baseline

Student-facing endpoints are self-scoped. Teacher endpoints return aggregates. Admin actions require RBAC and produce minimal audit events. Tokens and infrastructure credentials are environment-driven. APIs return pseudonymous labels wherever full identity is not necessary.

## Planned data flow

1. A student reports a case through an authenticated API endpoint.
2. The case service creates the record and starts a bounded investigation.
3. The graph service finds contacts within the disease's configurable demo exposure window.
4. The risk service builds features, asks the model service for an estimate, and stores explainable output.
5. The notification service creates carefully worded, non-diagnostic notifications for contacts above threshold.
6. Aggregate outcomes feed the admin dashboard and anonymized teacher views.
