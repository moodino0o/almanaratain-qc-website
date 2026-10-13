# Existing feature inventory

## Frontend routes

| Source route | Feature | Planned Laravel destination |
| --- | --- | --- |
| `/` | QC dashboard | React dashboard + Laravel dashboard API |
| `/records`, `/records/readymix`, `/records/masonry`, `/records/aggregate`, `/records/precast`, `/records/kerb-stone`, `/records/water` | QC registers by product/test type | React register views + records API |
| `/records/new`, `/records/:id`, `/records/:id/edit`, `/records/edit-all` | Record creation, details, editing, bulk editing | React forms + validated Laravel record endpoints |
| `/complaints`, `/complaints/new`, `/complaints/:id`, `/complaints/:id/edit`, `/complaints/:id/print` | Complaint workflow, review, print | React complaint pages + Laravel complaint endpoints |
| `/reports`, `/reports/:id` | Report design, listing, print | React report designer/print views + report APIs |
| `/settings`, `/standards` | Reference data and QC standards administration | React settings views + administrator-protected APIs |
| `/archive` | Document archive | React archive view + Laravel storage/metadata endpoints |
| `/login` | Employee-ID sign-in | Laravel session-backed authentication with the existing ID/role rules |

## API surface

The Express router contains approximately 77 route handlers across:

- QC dashboard, records, derived results, reference data, strength/water/sieve standards, shape factors, report templates, report layouts, and report generation.
- Employee login/access management, employee administration, and employee activity history.
- Complaint create/read/update/delete and review workflow.
- Archive document listing, metadata, content, upload, download, and deletion.
- Object upload URL generation and public/private object serving.
- Health checks.

Exact endpoint paths and payloads must be preserved from the source API and generated OpenAPI/Zod contracts as each feature is ported.

## Data and security

- PostgreSQL with Drizzle schemas for QC records, reference data, users/sessions/access, employee directory, complaints, archive documents, standards, report layouts/templates, and employee activity.
- QC record details include JSONB data; report templates and layouts also store structured JSON.
- Authentication is session based. Active employee identity and role permissions are checked server-side; employee access revocation and activity audit are part of the behavior.
- Uploaded files are stored outside PostgreSQL. The Laravel implementation must keep metadata in the database and use an explicitly configured storage provider; it must not copy storage credentials into source.
