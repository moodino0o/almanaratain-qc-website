# Laravel conversion plan

## Protection boundary

- All conversion files live under `laravel-conversion/`.
- Do not edit, move, or delete files in the original artifacts, API server, shared libraries, or database package.
- Do not change the root `package.json`, workspace lockfile, `.replit`, workflows, or current startup command.
- Copy assets into the conversion; never move them from the original.
- Do not connect to or migrate the original database. Use a separately configured PostgreSQL database after its schema is reviewed.
- Keep all environment values as placeholders in `.env.example`; real credentials belong in the environment's secret store.

## Architecture selected

The source is a React/Vite SPA backed by an Express 5 JSON API and PostgreSQL through Drizzle. The conversion will retain the React UI and its URLs, build it independently inside this directory, and replace the Express API with Laravel routes/controllers/services. The first-party React workspace imports must be copied or replaced with local code before the new frontend can build outside the pnpm monorepo.

The destination is a standalone Laravel 12 application requiring PHP 8.2 or later. The QC conversion has been verified with the Laravel test suite; deployment against a separate PostgreSQL database still needs integration verification.

## Implementation phases

1. **Foundation and inventory** — standalone Composer project, environment template, route/schema inventory, health endpoint, and setup instructions.
2. **Database layer** — map the existing PostgreSQL tables to non-destructive Laravel migrations and Eloquent models; preserve JSONB fields, constraints, indexes, and relationships.
3. **Identity and permissions** — employee-ID login, sessions, role/employee access, revocation checks, administrator gates, employee directory, and activity audit.
4. **QC APIs and domain rules** — records, lookups, reference data, standards, derived results, bulk editing, report templates/layouts, and existing calculation behavior.
5. **Other workflows** — complaints and review sign-off, archive documents, upload/download storage, employee administration, and all corresponding permissions.
6. **Frontend and reports** — copy the React source and assets into this directory, remove workspace-only imports, preserve route behavior and print layouts, and connect the UI to the Laravel API.
7. **Verification and handoff** — port domain tests, compare representative pages and API responses, document external PHP/Composer setup, and list anything not yet converted.

## Current state

The standalone Laravel project includes `/api/healthz`, QC and employee access APIs, complaint and archive APIs, the object-storage bridge, and a separately buildable copy of the original React/Vite client. Build/test the React client from `laravel-conversion`; configure an isolated PostgreSQL database and App Storage environment before deployment. External-provider and deployment verification still requires an environment with the Laravel runtime and storage sidecar configured.
