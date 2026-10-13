# Al Manaratain QC — Laravel conversion

This is a separate, incomplete Laravel conversion. It does not replace or modify the original React/Express application.

## Requirements

- PHP 8.2+
- Composer 2
- Node.js 20+ and pnpm when building the React application
- PostgreSQL

The conversion includes the original React/Vite pages, QC APIs, employee-ID sign-in/access controls, complaint review and printing, archive metadata/content/downloads, and direct-to-App-Storage uploads. React source and its generated client are copied under `resources/`, with no workspace package links.

## Safe setup

1. Copy `.env.example` to `.env`.
2. Configure an isolated PostgreSQL database for this conversion. Do not point it at the original application's database.
3. In this directory, run `composer install`, then `php artisan key:generate`.
4. Build the standalone frontend with `pnpm install` and `pnpm run build` from this directory.
5. Review the additive database migrations and confirm the configured database is separate before running them.
6. Run `php artisan migrate`, `php artisan serve`, and `composer test` in a compatible PHP environment.

The Vite build writes the SPA to `public/frontend`. Laravel serves the existing client-side routes, including complaint/report print paths, from that built entry point. API paths remain under `/api`. Configure `PRIVATE_OBJECT_DIR` and `PUBLIC_OBJECT_SEARCH_PATHS` in the runtime environment; signed URLs are obtained from the Replit object-storage sidecar, and only object paths and metadata are saved in PostgreSQL.

No real credentials belong in this directory or in `.env.example`.
