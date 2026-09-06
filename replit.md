# Al Manaratain Quality Control

A browser-based laboratory and production quality-control system with structured test entry, searchable records, review workflows, and printable certificates.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Optional env: `ARCHIVE_MANAGER_EMAILS` — comma-separated, case-insensitive email allowlist for archive retirement
- Optional env: `QC_ADMIN_EMPLOYEE_IDS` — comma-separated registered employee ID allowlist for QC employee access administration

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- Web application: `artifacts/al-manaratain-qc`
- API routes: `artifacts/api-server/src/routes/qc.ts`
- API contract: `lib/api-spec/openapi.yaml`
- Database model: `lib/db/src/schema/qc-records.ts`
- Brand theme: `artifacts/al-manaratain-qc/src/index.css`
- Official logo: `artifacts/al-manaratain-qc/public/al-manaratain-logo.webp`

## Architecture decisions

- Quality tests share one record envelope while type-specific measurements are stored in a structured JSON details map.
- Calendar-only sampling dates are stored as PostgreSQL `date` values to avoid timezone shifts.
- API request and response shapes are generated from the shared OpenAPI specification.
- Printable certificates have a dedicated A4 route and print stylesheet.

## Product

- Live control-room dashboard and recent activity.
- QC record entry for ready mix, blocks, paving blocks, sieve tests, water, flakiness/elongation, and RMX trials.
- Searchable test register with status review and deletion.
- Report center and branded A4 quality certificates.
- Reference data view for factories, plants, technicians, suppliers, materials, and product definitions.

## User preferences

- Match Al Manaratain branding and use the official logo.
- Preserve the Access program's QC workflows while making data entry and report printing browser-friendly.
- Printed report layouts should closely mirror the corresponding legacy Access forms.

## Gotchas

- Re-run API codegen after every OpenAPI change.
- The generated server validators coerce OpenAPI date strings to `Date`; convert them back to `YYYY-MM-DD` before writing PostgreSQL date columns.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
