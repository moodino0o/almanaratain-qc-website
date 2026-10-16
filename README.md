# almanaratain-qc-website

Quality-control website for managing daily tests and complaints at Al Manaratain.

## Run locally

This is a React/Vite frontend and Node.js API in a pnpm workspace. It is not a
Python application. The frontend and API run in separate terminals during
development.

### Requirements

- Node.js 22 or newer
- pnpm 10 (`corepack enable` then `corepack prepare pnpm@10.26.1 --activate`)
- PostgreSQL 15 or newer, with an empty local database for this app

Clone the repository, open a terminal in its root folder, then install the
workspace dependencies:

```sh
pnpm install
```

Create a local PostgreSQL database named `almanaratain_qc_local`, then apply the
current schema. Replace the connection URL with your local PostgreSQL username
and password. Do not point this command at a production database: schema push
can make database changes.

**macOS/Linux (Bash):**

```sh
export DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/almanaratain_qc_local"
pnpm --filter @workspace/db push
```

**Windows (PowerShell):**

```powershell
$env:DATABASE_URL = "postgresql://postgres:YOUR_PASSWORD@localhost:5432/almanaratain_qc_local"
pnpm --filter @workspace/db push
```

Start the API in the first terminal:

**macOS/Linux (Bash):**

```sh
export DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/almanaratain_qc_local"
export PORT=3001
export QC_ADMIN_EMPLOYEE_IDS="62925"
pnpm --filter @workspace/api-server dev
```

**Windows (PowerShell):**

```powershell
$env:DATABASE_URL = "postgresql://postgres:YOUR_PASSWORD@localhost:5432/almanaratain_qc_local"
$env:PORT = "3001"
$env:QC_ADMIN_EMPLOYEE_IDS = "62925"
pnpm --filter @workspace/api-server dev
```

In a second terminal, from the repository root, start the frontend:

**macOS/Linux (Bash):**

```sh
export PORT=5173
export BASE_PATH=/
pnpm --filter @workspace/al-manaratain-qc dev
```

**Windows (PowerShell):**

```powershell
$env:PORT = "5173"
$env:BASE_PATH = "/"
pnpm --filter @workspace/al-manaratain-qc dev
```

Open <http://localhost:5173>.

The Vite development server forwards `/api` requests to `http://127.0.0.1:3001`.
To use another API port, set `API_PROXY_TARGET` to its URL before starting the
frontend.

### Sign-in and local data

The API creates its tables' reference data on first startup, but employee
sign-in requires an active employee record with a password already set. A new
empty database has no usable employee password. Use a local database populated
with an authorized employee account, or have an administrator provision an
employee and password before signing in. `QC_ADMIN_EMPLOYEE_IDS` grants the
listed employee IDs administrator permissions after successful sign-in; it
does not create the employee or set a password.

Some file-upload and archive functions use Replit Object Storage. They require
separately configured storage when running outside Replit and are not available
in a fresh local setup by default.
